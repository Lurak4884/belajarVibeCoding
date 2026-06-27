import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema.js';

const sqlite = new Database('sqlite.db');

// Ensure table exists (especially useful for fresh cloud deployments)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_subscription_id TEXT NOT NULL UNIQUE,
    reference_id TEXT NOT NULL,
    msisdn TEXT NOT NULL UNIQUE,
    product_name TEXT,
    subscription_status TEXT DEFAULT 'pending' NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
  )
`);

export const db = drizzle(sqlite, { schema });
