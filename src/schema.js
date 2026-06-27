import { mysqlTable, serial, varchar, mysqlEnum, timestamp } from 'drizzle-orm/mysql-core';

export const subscriptions = mysqlTable('subscriptions', {
  id: serial('id').primaryKey(),
  partnerSubscriptionId: varchar('partner_subscription_id', { length: 100 }).notNull().unique(),
  referenceId: varchar('reference_id', { length: 36 }).notNull(),
  msisdn: varchar('msisdn', { length: 20 }).notNull().unique(),
  productName: varchar('product_name', { length: 100 }),
  subscriptionStatus: mysqlEnum('subscription_status', ['pending', 'inactive', 'active', 'unsubscribe']).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});
