import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Resend } from 'resend';

function getResendReceivingClient() {
  // emails.receiving.forward() requires a full_access API key — the
  // sending_access RESEND_API_KEY used by api/contact can't call it.
  const apiKey = process.env.RESEND_RECEIVING_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_RECEIVING_API_KEY is not configured');
  }
  return new Resend(apiKey);
}

type ResendEmailReceivedEvent = {
  type: string;
  data: { email_id: string };
};

export async function POST(req: Request) {
  const body = await req.text(); // raw body required for Svix verification

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[inbound-webhook] Missing RESEND_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: ResendEmailReceivedEvent;
  try {
    const headers = {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    };
    // verify() only checks the signature (throws if invalid) — it does not
    // return the parsed payload, so parse the now-trusted raw body ourselves.
    new Webhook(secret).verify(body, headers);
    event = JSON.parse(body) as ResendEmailReceivedEvent;
  } catch (err) {
    console.error('[inbound-webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (event.type === 'email.received') {
    try {
      const resend = getResendReceivingClient();
      await resend.emails.receiving.forward({
        emailId: event.data.email_id,
        to: process.env.INBOUND_NOTIFY_TO!,
        from: process.env.INBOUND_NOTIFY_FROM!,
      });
    } catch (err) {
      console.error('[inbound-webhook] forward failed:', err);
      // Non-2xx so Resend retries per its own retry policy
      return NextResponse.json({ error: 'Forward failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
