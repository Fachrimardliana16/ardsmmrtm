-- Ardson Maritime — MySQL schema
-- Import with phpMyAdmin, or let api/install.php run it once.
-- Every table uses InnoDB + utf8mb4 for Indonesian characters and emoji.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `counters` (
    `name` VARCHAR(40) NOT NULL,
    `value` BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
    `id` TINYINT NOT NULL,
    `data` LONGTEXT NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jobs` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `title` VARCHAR(160) NOT NULL DEFAULT '',
    `category` VARCHAR(20) NOT NULL DEFAULT 'deck',
    `vessel_type` VARCHAR(40) NOT NULL DEFAULT 'Container',
    `vessel_name` VARCHAR(80) NOT NULL DEFAULT '',
    `principal` VARCHAR(140) NOT NULL DEFAULT '',
    `flag_state` VARCHAR(60) NOT NULL DEFAULT '',
    `salary_min` INT NOT NULL DEFAULT 0,
    `salary_max` INT NOT NULL DEFAULT 0,
    `salary_currency` VARCHAR(8) NOT NULL DEFAULT 'USD',
    `contract_duration` VARCHAR(60) NOT NULL DEFAULT '4 months',
    `joining_date` VARCHAR(10) NOT NULL DEFAULT '',
    `status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `posted_at` VARCHAR(32) NOT NULL DEFAULT '',
    `extra` LONGTEXT NULL,
    PRIMARY KEY (`id`),
    KEY `jobs_status` (`status`),
    KEY `jobs_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `seafarers` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `reference` VARCHAR(32) NOT NULL DEFAULT '',
    `name` VARCHAR(160) NOT NULL DEFAULT '',
    `email` VARCHAR(190) NOT NULL DEFAULT '',
    `phone` VARCHAR(40) NOT NULL DEFAULT '',
    `applied_rank` VARCHAR(120) NOT NULL DEFAULT '',
    `vessel_experience` VARCHAR(80) NOT NULL DEFAULT 'Other',
    `certifications` LONGTEXT NULL,
    `cv_file` VARCHAR(180) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'new',
    `notes` TEXT NULL,
    `screened_by` VARCHAR(190) NULL,
    `screened_at` VARCHAR(32) NULL,
    `created_at` VARCHAR(32) NOT NULL DEFAULT '',
    `updated_at` VARCHAR(32) NULL,
    PRIMARY KEY (`id`),
    KEY `seafarers_sort` (`sort_order`),
    KEY `seafarers_reference` (`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crew_requests` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `reference` VARCHAR(32) NOT NULL DEFAULT '',
    `company_name` VARCHAR(190) NOT NULL DEFAULT '',
    `email` VARCHAR(190) NOT NULL DEFAULT '',
    `vessel_type` VARCHAR(60) NOT NULL DEFAULT '',
    `joining_date` VARCHAR(10) NOT NULL DEFAULT '',
    `required_ranks` TEXT NOT NULL,
    `contract_duration` VARCHAR(60) NOT NULL DEFAULT 'TBD',
    `flag_state` VARCHAR(80) NOT NULL DEFAULT 'TBD',
    `status` VARCHAR(30) NOT NULL DEFAULT 'new',
    `emergency` TINYINT NOT NULL DEFAULT 0,
    `port` VARCHAR(160) NULL,
    `reason` VARCHAR(160) NULL,
    `notes` TEXT NULL,
    `assigned_to` VARCHAR(190) NULL,
    `created_at` VARCHAR(32) NOT NULL DEFAULT '',
    `updated_at` VARCHAR(32) NULL,
    PRIMARY KEY (`id`),
    KEY `crew_requests_sort` (`sort_order`),
    KEY `crew_requests_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contacts` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `name` VARCHAR(160) NOT NULL DEFAULT '',
    `email` VARCHAR(190) NOT NULL DEFAULT '',
    `message` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'unread',
    `notes` TEXT NULL,
    `created_at` VARCHAR(32) NOT NULL DEFAULT '',
    `updated_at` VARCHAR(32) NULL,
    PRIMARY KEY (`id`),
    KEY `contacts_sort` (`sort_order`),
    KEY `contacts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscribers` (
    `email` VARCHAR(190) NOT NULL,
    `subscribed_at` VARCHAR(32) NOT NULL DEFAULT '',
    PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insights` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `slug` VARCHAR(220) NOT NULL,
    `title` VARCHAR(220) NOT NULL DEFAULT '',
    `tag` VARCHAR(80) NOT NULL DEFAULT 'Career guide',
    `date` VARCHAR(10) NOT NULL DEFAULT '',
    `read` VARCHAR(40) NOT NULL DEFAULT '4 min read',
    `image` VARCHAR(255) NOT NULL DEFAULT '',
    `lede` TEXT NULL,
    `body` LONGTEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `created_at` VARCHAR(32) NOT NULL DEFAULT '',
    `extra` LONGTEXT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `insights_slug` (`slug`),
    KEY `insights_status` (`status`),
    KEY `insights_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `slug` VARCHAR(80) NOT NULL DEFAULT '',
    `name` VARCHAR(120) NOT NULL DEFAULT '',
    `description` TEXT NULL,
    `permissions` LONGTEXT NULL,
    `locked` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `roles_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_users` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `name` VARCHAR(160) NOT NULL DEFAULT '',
    `email` VARCHAR(190) NOT NULL DEFAULT '',
    `role` VARCHAR(80) NOT NULL DEFAULT 'viewer',
    `status` VARCHAR(20) NOT NULL DEFAULT 'invited',
    `created_at` VARCHAR(32) NOT NULL DEFAULT '',
    `last_login` VARCHAR(32) NULL,
    PRIMARY KEY (`id`),
    KEY `admin_users_email` (`email`),
    KEY `admin_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_sessions` (
    `token_hash` CHAR(64) NOT NULL,
    `user` VARCHAR(190) NOT NULL,
    `issued_at` BIGINT NOT NULL,
    `expires_at` BIGINT NOT NULL,
    PRIMARY KEY (`token_hash`),
    KEY `admin_sessions_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `logs` (
    `id` VARCHAR(40) NOT NULL,
    `seq` BIGINT NOT NULL AUTO_INCREMENT,
    `level` VARCHAR(20) NOT NULL DEFAULT 'info',
    `actor` VARCHAR(190) NOT NULL DEFAULT 'system',
    `action` VARCHAR(160) NOT NULL DEFAULT '',
    `target` VARCHAR(160) NOT NULL DEFAULT '',
    `detail` TEXT NULL,
    `created_at` VARCHAR(32) NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    UNIQUE KEY `logs_seq` (`seq`),
    KEY `logs_level` (`level`),
    KEY `logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `backups` (
    `id` VARCHAR(40) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `filename` VARCHAR(190) NOT NULL DEFAULT '',
    `payload` LONGTEXT NOT NULL,
    `created_at` VARCHAR(32) NOT NULL DEFAULT '',
    `created_by` VARCHAR(190) NOT NULL DEFAULT '',
    `size_kb` INT NOT NULL DEFAULT 1,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ready',
    `counts` LONGTEXT NULL,
    PRIMARY KEY (`id`),
    KEY `backups_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
