ALTER TABLE `customers` ADD `opening_balance_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `opening_balance_cents` integer DEFAULT 0 NOT NULL;