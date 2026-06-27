import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// Get DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set. Database operations will fail if this is running in production.");
}

// Create postgres connection client
const client = postgres(connectionString || 'postgres://localhost:5432/mydb', {
  prepare: false // Required for some environments like PgBouncer
});

export const db = drizzle(client, { schema });
