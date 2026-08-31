// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    GTM_ID: process.env.GTM_ID,
  },
  async redirects() {
    return [
      // Old per-article Overview detail pages were retired when the
      // pipeline moved to daily category blocks (no more standalone
      // articles/slugs) — send old deep-links to the list page instead of
      // 404ing them.
      {
        source: '/overview/:date/:slug',
        destination: '/overview',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
