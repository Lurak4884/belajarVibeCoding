import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partnerSubscriptionId: text('partner_subscription_id').notNull().unique(),
  referenceId: text('reference_id').notNull(),
  msisdn: text('msisdn').notNull().unique(),
  productName: text('product_name'),
  subscriptionStatus: text('subscription_status', { enum: ['pending', 'inactive', 'active', 'unsubscribe'] }).default('pending').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});
