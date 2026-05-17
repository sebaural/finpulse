// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    GTM_ID: process.env.GTM_ID,
  },
};

export default nextConfig;
