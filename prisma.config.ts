// prisma.config.ts
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Next.js uses .env.local — load it for Prisma CLI commands
config({ path: '.env.local' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
