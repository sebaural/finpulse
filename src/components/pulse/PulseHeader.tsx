'use client';

import Image from 'next/image';
import NavMenu from '@/components/topNav/NavMenu';

export default function PulseHeader() {
  return (
    <header>
      <div className="header-inner">
        <div className="logo">
          <Image
            src="/macrostance-logo.png"
            alt="MacroStance mark"
            className="logo-mark"
            width={40}
            height={40}
            priority
          />
          <h1>MacroStance</h1>
        </div>
        <NavMenu />
      </div>
    </header>
  );
}
