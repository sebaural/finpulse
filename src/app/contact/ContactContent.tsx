'use client';

import { useState, FormEvent, useCallback } from 'react';
import Image from 'next/image';
import { useReCaptcha } from 'next-recaptcha-v3';
import SiteHeader from '@/components/SiteHeader';

const SUBJECTS = [
  'General Inquiry',
  'Press & Media',
  'Advertise with Us',
  'Report an Error',
  'Other',
];

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

export default function ContactContent() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const { executeRecaptcha } = useReCaptcha();

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStatus('loading');
      setErrorMsg('');

      // Generate fresh reCAPTCHA token just before submit
      const recaptchaToken = await executeRecaptcha('contact_form');

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            subject: form.subject,
            message: form.message,
            recaptchaToken,
          }),
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? 'Something went wrong.');
        }

        setStatus('success');
        setForm({
          name: '',
          email: '',
          subject: SUBJECTS[0],
          message: '',
        });
      } catch (err: unknown) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to send message.');
      }
    },
    [form, executeRecaptcha]
  );

  return (
    <>
      <SiteHeader />
      <main className="page contact-page">
        <div className="contact-header">
          <span className="contact-eyebrow">Get in Touch</span>
          <h1 className="contact-h1">Contact Us</h1>
          <p className="contact-intro">
            Have a question, tip, or feedback? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="contact-body">
          {/* Form column */}
          <div className="contact-form-col">
            {status === 'success' ? (
              <div className="contact-success" role="status" aria-live="polite">
                <span className="contact-success-icon" aria-hidden="true">✓</span>
                <div>
                  <strong>Message sent.</strong>
                  <p>
                    We&apos;ll be in touch soon. You can expect a response within
                    2 business days.
                  </p>
                </div>
              </div>
            ) : (
              <form
                className="contact-form"
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="contact-form-row">
                  <div className="contact-field">
                    <label htmlFor="name" className="contact-label">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      className="contact-input"
                      placeholder="Your name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      autoComplete="name"
                      disabled={status === 'loading'}
                    />
                  </div>
                  <div className="contact-field">
                    <label htmlFor="email" className="contact-label">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="contact-input"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                      disabled={status === 'loading'}
                    />
                  </div>
                </div>

                <div className="contact-field">
                  <label htmlFor="subject" className="contact-label">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    className="contact-input contact-select"
                    value={form.subject}
                    onChange={handleChange}
                    disabled={status === 'loading'}
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="contact-field">
                  <label htmlFor="message" className="contact-label">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    className="contact-input contact-textarea"
                    placeholder="Tell us how we can help..."
                    rows={5}
                    value={form.message}
                    onChange={handleChange}
                    required
                    disabled={status === 'loading'}
                  />
                </div>

                {status === 'error' && (
                  <div className="contact-error" role="alert">
                    <span className="contact-error-icon" aria-hidden="true">✕</span>
                    <div>
                      <strong>Failed to send message</strong>
                      <p>{errorMsg}</p>
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="contact-submit"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Sending…' : 'Send Message'}
                </button>

                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '1rem' }}>
                  This site is protected by reCAPTCHA and the Google{' '}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">
                    Terms of Service
                  </a>{' '}
                  apply.
                </p>
              </form>
            )}
          </div>

          {/* Contact details panel */}
          <aside className="contact-details-card" aria-label="Contact information">
            <div className="contact-logo-row">
              <Image
                src="/macrostance-logo.png"
                alt="MacroStance logo"
                width={48}
                height={48}
                className="contact-logo-img"
              />
              <span className="contact-logo-name">MacroStance</span>
            </div>

            <div className="contact-emails">
              <div className="contact-email-row">
                <span className="contact-email-label">General</span>
                <a
                  href="mailto:hello@macrostance.com"
                  className="contact-email-link"
                >
                  hello@macrostance.com
                </a>
              </div>
              <div className="contact-email-row">
                <span className="contact-email-label">Press</span>
                <a
                  href="mailto:press@macrostance.com"
                  className="contact-email-link"
                >
                  press@macrostance.com
                </a>
              </div>
              <div className="contact-email-row">
                <span className="contact-email-label">Advertising</span>
                <a
                  href="mailto:ads@macrostance.com"
                  className="contact-email-link"
                >
                  ads@macrostance.com
                </a>
              </div>
            </div>

            <div className="contact-response-card">
              <span className="contact-response-label">Response Time</span>
              <span className="contact-response-value">Within 2 business days</span>
              <p className="contact-response-note">
                Our team monitors all inboxes during market hours, Monday through
                Friday.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
