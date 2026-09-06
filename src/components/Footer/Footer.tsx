import Link from 'next/link';
import './Footer.css';

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Geopolitics', href: '/geopolitics' },
      { label: 'Markets', href: '/markets' },
      { label: 'Tech', href: '/tech' },
      { label: 'Live Feed', href: '/live-feed' },
      { label: 'Macro Landscape', href: '/macro-landscape' },
      { label: 'Deep-Dive Analysis', href: '/deep-dive-analysis' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Editorial Standards', href: '/editorial-standards' },
      { label: 'Data Sources', href: '/data-sources' },
      { label: 'Contact', href: '/contact' },
      { label: 'Follow on X', href: 'https://x.com/macrostance', external: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Use', href: '/terms' },
      { label: 'Disclaimer', href: '/disclaimer' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-cols">
        {FOOTER_COLUMNS.map(({ heading, links }) => (
          <div className="footer-col" key={heading}>
            <h3>{heading}</h3>
            <ul>
              {links.map(({ label, href, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {label}
                    </a>
                  ) : (
                    <Link href={href}>{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} MacroStance. All rights reserved.
      </div>
    </footer>
  );
}
