CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`partner_subscription_id` text NOT NULL,
	`reference_id` text NOT NULL,
	`msisdn` text NOT NULL,
	`product_name` text,
	`subscription_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_partner_subscription_id_unique` ON `subscriptions` (`partner_subscription_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_msisdn_unique` ON `subscriptions` (`msisdn`);