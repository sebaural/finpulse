import type { Metadata } from 'next';
import PrivacyContent from './PrivacyContent';
import { buildMetadata } from '@/lib/seo';
import './privacy.css';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy — How MacroStance Handles Your Data',
  description:
    'Read the MacroStance Privacy Policy: what data we collect, how we use it, your GDPR and CCPA rights, cookies, and how to contact us with privacy questions.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return <PrivacyContent />;
}
