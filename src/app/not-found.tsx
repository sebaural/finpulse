import Link from "next/link";
import SearchBox from "@/components/search/SearchBox";
import Image from 'next/image';
import "./not-found.css";
import NavMenu from '@/components/topNav/NavMenu';

export default function NotFound() {
  return (
    <>
    {/* ── Top nav bar ── */}
        <div className="geo-top-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 24px', borderBottom: '1px solid #1e2530', background: '#111418' }}>
          <Link href="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <span>MacroStance</span>
          </Link>
          <NavMenu variant="dark" />
        </div>

    <div className="notfound-page">
      <div className="notfound-container">
        <span className="notfound-code">404</span>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-subtitle">
          The page you're looking for doesn't exist or may have moved.
        </p>

        <div className="notfound-search">
          <SearchBox placeholder="Search the site..." autoFocus />
        </div>
      </div>
    </div>
    </>
  );
}

