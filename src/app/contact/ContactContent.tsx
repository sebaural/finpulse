'use client';

import { useState } from 'react';
import Image from 'next/image';
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

export default function ContactContent() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <SiteHeader />
      <div className="page contact-page">
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
          {submitted ? (
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
              aria-label="Contact form"
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
                />
              </div>

              <button type="submit" className="contact-submit">
                Send Message
              </button>
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
    </div>
    </>
  );
}
