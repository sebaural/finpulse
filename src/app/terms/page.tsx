import type { Metadata } from 'next';
import TermsContent from './TermsContent';
import '../privacy/privacy.css';
import './terms.css';

export const metadata: Metadata = {
  title: 'Terms of Use — MacroStance',
  description:
    'MacroStance Terms of Use — the terms governing your use of the MacroStance platform.',
};

export default function TermsPage() {
  return <TermsContent />;
}
