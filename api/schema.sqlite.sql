-- Ardson Maritime — SQLite schema
-- Used automatically when db.driver = "sqlite".
-- The installer runs this once, then writes storage/installed.lock.

CREATE TABLE IF NOT EXISTS `counters` (
    `name` TEXT NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`name`)
);

CREATE TABLE IF NOT EXISTS `settings` (
    `id` INTEGER NOT NULL,
    `data` TEXT NOT NULL,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `jobs` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `title` TEXT NOT NULL DEFAULT '',
    `category` TEXT NOT NULL DEFAULT 'deck',
    `vessel_type` TEXT NOT NULL DEFAULT 'Container',
    `vessel_name` TEXT NOT NULL DEFAULT '',
    `principal` TEXT NOT NULL DEFAULT '',
    `flag_state` TEXT NOT NULL DEFAULT '',
    `salary_min` INTEGER NOT NULL DEFAULT 0,
    `salary_max` INTEGER NOT NULL DEFAULT 0,
    `salary_currency` TEXT NOT NULL DEFAULT 'USD',
    `contract_duration` TEXT NOT NULL DEFAULT '4 months',
    `joining_date` TEXT NOT NULL DEFAULT '',
    `status` TEXT NOT NULL DEFAULT 'open',
    `posted_at` TEXT NOT NULL DEFAULT '',
    `extra` TEXT NULL,
    PRIMARY KEY (`id`)
);
CREATE INDEX IF NOT EXISTS `jobs_status` ON `jobs` (`status`);
CREATE INDEX IF NOT EXISTS `jobs_sort` ON `jobs` (`sort_order`);

CREATE TABLE IF NOT EXISTS `seafarers` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `reference` TEXT NOT NULL DEFAULT '',
    `name` TEXT NOT NULL DEFAULT '',
    `email` TEXT NOT NULL DEFAULT '',
    `phone` TEXT NOT NULL DEFAULT '',
    `applied_rank` TEXT NOT NULL DEFAULT '',
    `vessel_experience` TEXT NOT NULL DEFAULT 'Other',
    `certifications` TEXT NULL,
    `cv_file` TEXT NULL,
    `status` TEXT NOT NULL DEFAULT 'new',
    `notes` TEXT NULL,
    `screened_by` TEXT NULL,
    `screened_at` TEXT NULL,
    `created_at` TEXT NOT NULL DEFAULT '',
    `updated_at` TEXT NULL,
    PRIMARY KEY (`id`)
);
CREATE INDEX IF NOT EXISTS `seafarers_sort` ON `seafarers` (`sort_order`);
CREATE INDEX IF NOT EXISTS `seafarers_reference` ON `seafarers` (`reference`);

CREATE TABLE IF NOT EXISTS `crew_requests` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `reference` TEXT NOT NULL DEFAULT '',
    `company_name` TEXT NOT NULL DEFAULT '',
    `email` TEXT NOT NULL DEFAULT '',
    `vessel_type` TEXT NOT NULL DEFAULT '',
    `joining_date` TEXT NOT NULL DEFAULT '',
    `required_ranks` TEXT NOT NULL,
    `contract_duration` TEXT NOT NULL DEFAULT 'TBD',
    `flag_state` TEXT NOT NULL DEFAULT 'TBD',
    `status` TEXT NOT NULL DEFAULT 'new',
    `emergency` INTEGER NOT NULL DEFAULT 0,
    `port` TEXT NULL,
    `reason` TEXT NULL,
    `notes` TEXT NULL,
    `assigned_to` TEXT NULL,
    `created_at` TEXT NOT NULL DEFAULT '',
    `updated_at` TEXT NULL,
    PRIMARY KEY (`id`)
);
CREATE INDEX IF NOT EXISTS `crew_requests_sort` ON `crew_requests` (`sort_order`);
CREATE INDEX IF NOT EXISTS `crew_requests_status` ON `crew_requests` (`status`);

CREATE TABLE IF NOT EXISTS `contacts` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `name` TEXT NOT NULL DEFAULT '',
    `email` TEXT NOT NULL DEFAULT '',
    `message` TEXT NOT NULL,
    `status` TEXT NOT NULL DEFAULT 'unread',
    `notes` TEXT NULL,
    `created_at` TEXT NOT NULL DEFAULT '',
    `updated_at` TEXT NULL,
    PRIMARY KEY (`id`)
);
CREATE INDEX IF NOT EXISTS `contacts_sort` ON `contacts` (`sort_order`);
CREATE INDEX IF NOT EXISTS `contacts_status` ON `contacts` (`status`);

CREATE TABLE IF NOT EXISTS `subscribers` (
    `email` TEXT NOT NULL,
    `subscribed_at` TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (`email`)
);

CREATE TABLE IF NOT EXISTS `insights` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `slug` TEXT NOT NULL,
    `title` TEXT NOT NULL DEFAULT '',
    `tag` TEXT NOT NULL DEFAULT 'Career guide',
    `date` TEXT NOT NULL DEFAULT '',
    `read` TEXT NOT NULL DEFAULT '4 min read',
    `image` TEXT NOT NULL DEFAULT '',
    `lede` TEXT NULL,
    `body` TEXT NULL,
    `status` TEXT NOT NULL DEFAULT 'draft',
    `created_at` TEXT NOT NULL DEFAULT '',
    `extra` TEXT NULL,
    PRIMARY KEY (`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `insights_slug` ON `insights` (`slug`);
CREATE INDEX IF NOT EXISTS `insights_status` ON `insights` (`status`);
CREATE INDEX IF NOT EXISTS `insights_date` ON `insights` (`date`);

CREATE TABLE IF NOT EXISTS `roles` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `slug` TEXT NOT NULL DEFAULT '',
    `name` TEXT NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `permissions` TEXT NULL,
    `locked` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
);
CREATE INDEX IF NOT EXISTS `roles_slug` ON `roles` (`slug`);

CREATE TABLE IF NOT EXISTS `admin_users` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `name` TEXT NOT NULL DEFAULT '',
    `email` TEXT NOT NULL DEFAULT '',
    `role` TEXT NOT NULL DEFAULT 'viewer',
    `status` TEXT NOT NULL DEFAULT 'invited',
    `created_at` TEXT NOT NULL DEFAULT '',
    `last_login` TEXT NULL,
    PRIMARY KEY (`id`)
);
CREATE INDEX IF NOT EXISTS `admin_users_email` ON `admin_users` (`email`);
CREATE INDEX IF NOT EXISTS `admin_users_role` ON `admin_users` (`role`);

CREATE TABLE IF NOT EXISTS `admin_sessions` (
    `token_hash` TEXT NOT NULL,
    `user` TEXT NOT NULL,
    `issued_at` INTEGER NOT NULL,
    `expires_at` INTEGER NOT NULL,
    PRIMARY KEY (`token_hash`)
);
CREATE INDEX IF NOT EXISTS `admin_sessions_expiry` ON `admin_sessions` (`expires_at`);

-- SQLite allows only one primary key. seq keeps the auto-increment
-- behaviour; id stays unique because the API addresses rows by id.
CREATE TABLE IF NOT EXISTS `logs` (
    `seq` INTEGER PRIMARY KEY AUTOINCREMENT,
    `id` TEXT NOT NULL UNIQUE,
    `level` TEXT NOT NULL DEFAULT 'info',
    `actor` TEXT NOT NULL DEFAULT 'system',
    `action` TEXT NOT NULL DEFAULT '',
    `target` TEXT NOT NULL DEFAULT '',
    `detail` TEXT NULL,
    `created_at` TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS `logs_level` ON `logs` (`level`);
CREATE INDEX IF NOT EXISTS `logs_created` ON `logs` (`created_at`);

CREATE TABLE IF NOT EXISTS `backups` (
    `id` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `filename` TEXT NOT NULL DEFAULT '',
    `payload` TEXT NOT NULL,
    `created_at` TEXT NOT NULL DEFAULT '',
    `created_by` TEXT NOT NULL DEFAULT '',
    `size_kb` INTEGER NOT NULL DEFAULT 1,
    `status` TEXT NOT NULL DEFAULT 'ready',
    `counts` TEXT NULL,
    PRIMARY KEY (`id`)
);
CREATE INDEX IF NOT EXISTS `backups_sort` ON `backups` (`sort_order`);
