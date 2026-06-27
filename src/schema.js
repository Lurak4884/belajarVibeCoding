import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  partnerSubscriptionId: varchar('partner_subscription_id', { length: 255 }).notNull().unique(),
  referenceId: varchar('reference_id', { length: 255 }).notNull(),
  msisdn: varchar('msisdn', { length: 20 }).notNull().unique(),
  productName: varchar('product_name', { length: 255 }),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});
