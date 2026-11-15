import type { Metadata } from 'next';
import { ReCaptchaProvider } from 'next-recaptcha-v3';
import ContactContent from './ContactContent';
import { buildMetadata } from '@/lib/seo';
import './contact.css';

export const metadata: Metadata = buildMetadata({
  title: 'Contact MacroStance — Press, Editorial, and Corrections',
  description:
    'Reach the MacroStance team for press inquiries, editorial questions, advertising, partnerships, or to report a correction. We respond within two business days.',
  path: '/contact',
});

export default function ContactPage() {
  // reCAPTCHA is only needed here — scoping the provider to /contact keeps
  // Google's api.js (and its <link rel="preload">) off every other page.
  return (
    <ReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}>
      <ContactContent />
    </ReCaptchaProvider>
  );
}
