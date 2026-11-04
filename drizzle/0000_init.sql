CREATE TABLE `analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`subject_id` text NOT NULL,
	`photographer_id` text NOT NULL,
	`day` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_dedupe_idx` ON `analytics_events` (`type`,`subject_id`,`day`,`visitor_hash`);--> statement-breakpoint
CREATE INDEX `analytics_photographer_idx` ON `analytics_events` (`photographer_id`,`type`);--> statement-breakpoint
CREATE TABLE `analytics_salts` (
	`day` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_tokens_user_idx` ON `auth_tokens` (`user_id`,`purpose`);--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`details` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `modlog_target_idx` ON `moderation_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `modlog_created_idx` ON `moderation_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`region_slug` text NOT NULL,
	`location_text` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`author_name` text NOT NULL,
	`year_taken` integer NOT NULL,
	`has_people` integer NOT NULL,
	`has_minor` integer NOT NULL,
	`confirmed_rights` integer NOT NULL,
	`confirmed_consent` integer NOT NULL,
	`confirmed_rules` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`hidden_at` integer,
	`hidden_reason` text,
	`csam_locked_at` integer,
	`csam_locked_by` text,
	`legal_hold` integer DEFAULT false NOT NULL,
	`rejection_reason` text,
	`rejection_note` text,
	`rejected_at` integer,
	`delete_after` integer,
	`approved_at` integer,
	`approved_by` text,
	`alt_fr` text DEFAULT '' NOT NULL,
	`alt_ar` text DEFAULT '' NOT NULL,
	`alt_en` text DEFAULT '' NOT NULL,
	`ai_status` text DEFAULT 'not_run' NOT NULL,
	`ai_provider` text,
	`ai_flags` text,
	`ai_checked_at` integer,
	`ai_error` text,
	`processing` text DEFAULT 'queued' NOT NULL,
	`processing_error` text,
	`processing_attempts` integer DEFAULT 0 NOT NULL,
	`processing_started_at` integer,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`orientation` text NOT NULL,
	`original_key` text NOT NULL,
	`original_mime` text NOT NULL,
	`original_bytes` integer NOT NULL,
	`original_sha256` text NOT NULL,
	`public_token` text NOT NULL,
	`blur_data_url` text,
	`variants` text DEFAULT '[]' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`contact_count` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_status_idx` ON `photos` (`status`,`approved_at`);--> statement-breakpoint
CREATE INDEX `photos_owner_idx` ON `photos` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `photos_region_idx` ON `photos` (`region_slug`);--> statement-breakpoint
CREATE INDEX `photos_category_idx` ON `photos` (`category`);--> statement-breakpoint
CREATE INDEX `photos_sha_idx` ON `photos` (`original_sha256`);--> statement-breakpoint
CREATE INDEX `photos_processing_idx` ON `photos` (`processing`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`region_slug` text,
	`city` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`instagram` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`show_whatsapp` integer DEFAULT false NOT NULL,
	`show_email` integer DEFAULT false NOT NULL,
	`avatar_status` text DEFAULT 'none' NOT NULL,
	`avatar` text,
	`featured` integer DEFAULT false NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_slug_unique` ON `profiles` (`slug`);--> statement-breakpoint
CREATE INDEX `profiles_featured_idx` ON `profiles` (`featured`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text,
	`source` text DEFAULT 'button' NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`reporter_name` text DEFAULT '' NOT NULL,
	`reporter_email` text DEFAULT '' NOT NULL,
	`photo_url` text DEFAULT '' NOT NULL,
	`reporter_hash` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text,
	`resolved_at` integer,
	`resolved_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reports_photo_idx` ON `reports` (`photo_id`,`status`);--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'photographer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`suspended_reason` text,
	`suspended_at` integer,
	`email_verified_at` integer,
	`locale` text DEFAULT 'fr' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);