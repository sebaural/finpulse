import Link from 'next/link';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
{ label: 'About Us', href: '/about' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Use', href: '/terms' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Disclaimer', href: '/disclaimer' },
];

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      color: 'var(--muted)',
      fontSize: '0.8rem',
      padding: '1.25rem 2rem',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
    }}>
      <span>&copy; {new Date().getFullYear()} MacroStance. All rights reserved.</span>
      <nav style={{ display: 'flex', gap: '1.25rem' }} className="footer-nav">
        {NAV_LINKS.map(({ label, href }) => (
          <Link key={label} href={href} className="footer-nav-link">
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
