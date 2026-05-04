import type { Metadata } from 'next';
import ContactContent from './ContactContent';
import './contact.css';

export const metadata: Metadata = {
  title: 'Contact Us — MacroStance',
  description:
    'Get in touch with the MacroStance team — for general inquiries, press, advertising, or reporting an error.',
};

export default function ContactPage() {
  return <ContactContent />;
}
