CREATE TABLE `subscriptions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`partner_subscription_id` varchar(100) NOT NULL,
	`reference_id` varchar(36) NOT NULL,
	`msisdn` varchar(20) NOT NULL,
	`product_name` varchar(100),
	`subscription_status` enum('pending','inactive','active','unsubscribe') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_partner_subscription_id_unique` UNIQUE(`partner_subscription_id`),
	CONSTRAINT `subscriptions_msisdn_unique` UNIQUE(`msisdn`)
);
