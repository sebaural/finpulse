import type { Metadata } from 'next';
import PrivacyContent from './PrivacyContent';
import './privacy.css';

export const metadata: Metadata = {
  title: 'Privacy Policy — MacroStance',
  description:
    'MacroStance Privacy Policy — how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
