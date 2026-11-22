CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`receipt_number` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`payment_date` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`narration` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_receipt_number_unique` ON `payments` (`receipt_number`);--> statement-breakpoint
CREATE INDEX `payments_customer_id_idx` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payments_payment_date_idx` ON `payments` (`payment_date`);--> statement-breakpoint
CREATE TABLE `sale_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`job_name` text NOT NULL,
	`rota_qty` real DEFAULT 0 NOT NULL,
	`rota_rate_cents` integer DEFAULT 0 NOT NULL,
	`rota_amount_cents` integer DEFAULT 0 NOT NULL,
	`gto_qty` real DEFAULT 0 NOT NULL,
	`gto_rate_cents` integer DEFAULT 0 NOT NULL,
	`gto_amount_cents` integer DEFAULT 0 NOT NULL,
	`cutting_qty` real DEFAULT 0 NOT NULL,
	`cutting_rate_cents` integer DEFAULT 0 NOT NULL,
	`cutting_amount_cents` integer DEFAULT 0 NOT NULL,
	`lamination_qty` real DEFAULT 0 NOT NULL,
	`lamination_rate_cents` integer DEFAULT 0 NOT NULL,
	`lamination_amount_cents` integer DEFAULT 0 NOT NULL,
	`dye_qty` real DEFAULT 0 NOT NULL,
	`dye_rate_cents` integer DEFAULT 0 NOT NULL,
	`dye_amount_cents` integer DEFAULT 0 NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sale_jobs_sale_id_idx` ON `sale_jobs` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bill_number` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`sale_date` integer NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_bill_number_unique` ON `sales` (`bill_number`);--> statement-breakpoint
CREATE INDEX `sales_customer_id_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_sale_date_idx` ON `sales` (`sale_date`);