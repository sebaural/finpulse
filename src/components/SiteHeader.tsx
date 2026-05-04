'use client';

import Image from 'next/image';
import Link from 'next/link';
import NavMenu from '@/components/topNav/NavMenu';

export default function SiteHeader() {
  return (
    <header>
      <div className="header-inner">
        <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
          <Image
            src="/macrostance-logo.png"
            alt="MacroStance mark"
            className="logo-mark"
            width={40}
            height={40}
            priority
          />
          <span>MacroStance</span>
        </Link>
        <NavMenu />
      </div>
    </header>
  );
}
