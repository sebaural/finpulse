import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { contactRateLimit } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

async function verifyRecaptcha(token: string): Promise<number> {
  // Skip verification in development — localhost is not a registered reCAPTCHA domain
  if (process.env.NODE_ENV === 'development') {
    return 1.0;
  }

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY!,
      response: token,
    }),
  });
  const data = await res.json();

  if (!data.success) {
    // Log the error codes for debugging (visible in Vercel logs)
    console.error('[contact API] reCAPTCHA verification failed:', data['error-codes']);
    // Treat as configuration/domain issue rather than bot — don't hard-block real users
    // Fix: register macrostance.com in the Google reCAPTCHA console if this keeps firing
    return 1.0;
  }

  console.log(`[contact API] reCAPTCHA score: ${data.score}`);
  return data.score as number;
}

export async function POST(req: NextRequest) {
  // ── 1. Rate limiting ────────────────────────────────────────────
  const ip = getIP(req);
  const { success: withinLimit, remaining, reset } = await contactRateLimit.limit(ip);

  if (!withinLimit) {
    const retryAfterSec = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Too many requests. Please try again in ${retryAfterSec}s.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // ── 2. Parse & validate ─────────────────────────────────────────
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { name, email, subject, message, recaptchaToken } = body;

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Name, email, and message are required.' },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  // ── 3. reCAPTCHA verification ───────────────────────────────────
  if (!recaptchaToken) {
    return NextResponse.json({ error: 'Missing reCAPTCHA token.' }, { status: 400 });
  }

  const score = await verifyRecaptcha(recaptchaToken);

  // Block confirmed bots. Threshold 0.3 is appropriate for new sites
  // (reCAPTCHA v3 scores conservatively until it learns your traffic).
  // Only fires when success:true — config failures pass through above.
  if (score < 0.3) {
    return NextResponse.json(
      { error: 'Submission blocked as potential spam.' },
      { status: 403 }
    );
  }

  // ── 4. Send email via Resend ────────────────────────────────────
  try {
    await resend.emails.send({
      from: `MacroStance Contact <${process.env.FROM_EMAIL}>`,
      to: process.env.TO_EMAIL!,
      replyTo: email,
      subject: `[Contact] ${subject ?? 'General Inquiry'} — ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject ?? 'General Inquiry'}</p>
        <p><strong>reCAPTCHA Score:</strong> ${score} (1.0 = human)</p>
        <hr/>
        <p>${message.replace(/\n/g, '<br/>')}</p>
      `,
    });

    return NextResponse.json(
      { success: true, remaining },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (err) {
    console.error('[contact API] email send failed:', err);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
