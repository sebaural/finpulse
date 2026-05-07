import type { Metadata } from 'next';
import TermsContent from './TermsContent';
import { buildMetadata } from '@/lib/seo';
import '../privacy/privacy.css';
import './terms.css';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of Use — Rules for Using MacroStance',
  description:
    'The MacroStance Terms of Use govern access to our platform: user conduct, content licensing, intellectual property, disclaimers, and dispute resolution.',
  path: '/terms',
});

export default function TermsPage() {
  return <TermsContent />;
}
