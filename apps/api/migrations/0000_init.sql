CREATE TABLE `audit_log` (
	`id` char(36) NOT NULL,
	`site_id` char(36) NOT NULL,
	`at` datetime(3) NOT NULL,
	`user_id` char(36),
	`entity` varchar(64) NOT NULL,
	`entity_id` char(36) NOT NULL,
	`action` varchar(32) NOT NULL,
	`before` json,
	`after` json,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee` (
	`id` char(36) NOT NULL,
	`site_id` char(36) NOT NULL,
	`full_name` varchar(120) NOT NULL,
	`badge_number` varchar(6),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `employee_id` PRIMARY KEY(`id`),
	CONSTRAINT `employee_badge_uq` UNIQUE(`site_id`,`badge_number`)
);
--> statement-breakpoint
CREATE TABLE `equipment_item` (
	`id` char(36) NOT NULL,
	`site_id` char(36) NOT NULL,
	`kind` enum('gumibot','gazspray','bilincs','jelveny','egyeb') NOT NULL,
	`serial` varchar(40) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `equipment_item_id` PRIMARY KEY(`id`),
	CONSTRAINT `equipment_serial_uq` UNIQUE(`site_id`,`kind`,`serial`)
);
--> statement-breakpoint
CREATE TABLE `gate` (
	`id` char(36) NOT NULL,
	`site_id` char(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `gate_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incident_category` (
	`id` char(36) NOT NULL,
	`site_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `incident_category_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`token_hash` char(64) NOT NULL,
	`user_id` char(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`user_agent` varchar(255),
	CONSTRAINT `session_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `site` (
	`id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'Europe/Budapest',
	`settings` json NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `site_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_op` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`received_at` datetime(3) NOT NULL,
	`result` json,
	CONSTRAINT `sync_op_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_account` (
	`id` char(36) NOT NULL,
	`site_id` char(36) NOT NULL,
	`username` varchar(120) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('or','orparancsnok','parancsnok','admin') NOT NULL,
	`employee_id` char(36),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `user_account_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_username_uq` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `weapon` (
	`id` char(36) NOT NULL,
	`site_id` char(36) NOT NULL,
	`model` varchar(60) NOT NULL,
	`kind` enum('pisztoly','gepkarabely') NOT NULL,
	`serial` varchar(40) NOT NULL,
	`storage` varchar(120),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `weapon_id` PRIMARY KEY(`id`),
	CONSTRAINT `weapon_serial_uq` UNIQUE(`site_id`,`serial`)
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_at_idx` ON `audit_log` (`site_id`,`at`);--> statement-breakpoint
CREATE INDEX `employee_site_idx` ON `employee` (`site_id`,`active`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);