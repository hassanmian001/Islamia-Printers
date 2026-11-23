CREATE TABLE `quotation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quotation_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`description` text NOT NULL,
	`qty` real DEFAULT 0 NOT NULL,
	`rate_cents` integer DEFAULT 0 NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quotation_items_quotation_id_idx` ON `quotation_items` (`quotation_id`);--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quotation_number` integer NOT NULL,
	`customer_id` integer,
	`customer_name` text NOT NULL,
	`customer_phone` text,
	`quotation_date` integer NOT NULL,
	`valid_until` integer,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`converted_sale_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`converted_sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_number_unique` ON `quotations` (`quotation_number`);--> statement-breakpoint
CREATE INDEX `quotations_date_idx` ON `quotations` (`quotation_date`);