-- Islamia Printers keeps job sales and a customer khata only: products, stock,
-- purchases, suppliers and returns are gone. Tables are dropped children first,
-- because with foreign keys on, dropping a parent that still has rows pointing
-- at it fails.
DROP TABLE `stock_movements`;--> statement-breakpoint
DROP TABLE `sale_return_items`;--> statement-breakpoint
DROP TABLE `purchase_return_items`;--> statement-breakpoint
DROP TABLE `sale_returns`;--> statement-breakpoint
DROP TABLE `purchase_returns`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
DROP TABLE `sale_items`;--> statement-breakpoint
DROP TABLE `purchase_items`;--> statement-breakpoint
DROP TABLE `sales`;--> statement-breakpoint
DROP TABLE `purchases`;--> statement-breakpoint
DROP TABLE `product_variants`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
DROP TABLE `suppliers`;
