import type { Metadata } from 'next';
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
  return <ContactContent />;
}
