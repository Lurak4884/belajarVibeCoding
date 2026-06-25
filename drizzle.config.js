import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  // drizzle-kit can load .env automatically, but we check just in case
  console.warn('Warning: DATABASE_URL environment variable is not set.');
}

export default defineConfig({
  schema: './src/schema.js',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
