CREATE TABLE `feed_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`published_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `feed_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_items_source_external_unique` ON `feed_items` (`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `feed_items_published_at_idx` ON `feed_items` (`published_at`);--> statement-breakpoint
CREATE TABLE `feed_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`homepage_url` text NOT NULL,
	`feed_url` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_checked_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_sources_feed_url_unique` ON `feed_sources` (`feed_url`);--> statement-breakpoint
CREATE INDEX `feed_sources_last_checked_at_idx` ON `feed_sources` (`last_checked_at`);