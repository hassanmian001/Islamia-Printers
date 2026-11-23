CREATE TABLE `cash_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`description` text NOT NULL,
	`qty` real DEFAULT 0 NOT NULL,
	`rate_cents` integer DEFAULT 0 NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cash_sale_items_sale_id_idx` ON `cash_sale_items` (`sale_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `method` text DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `sale_id` integer REFERENCES sales(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `payments_sale_id_idx` ON `payments` (`sale_id`);--> statement-breakpoint
ALTER TABLE `sales` ADD `kind` text DEFAULT 'job' NOT NULL;