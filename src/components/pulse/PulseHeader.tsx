'use client';

import Image from 'next/image';
import NavMenu from '@/components/topNav/NavMenu';
import Link from 'next/link';

export default function PulseHeader() {
  return (
    <header>
      <div className="header-inner"><Link href="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <span className='pulse-logo-text'>MacroStance</span>
          </Link>
        <NavMenu />
      </div>
    </header>
  );
}
