-- Import into a new, empty database selected in the hosting panel.
-- Application schema only. No customer records or credentials.
SET NAMES utf8mb4;

CREATE TABLE `raketa_afisha` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data` mediumtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `raketa_birthday_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `catalog_version` varchar(64) DEFAULT NULL,
  `plan_json` mediumtext NOT NULL,
  `estimate_json` mediumtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `booking_id` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `raketa_bookings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `event_type` varchar(255) DEFAULT NULL,
  `event_date` varchar(64) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `status` varchar(32) DEFAULT 'new',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tg_sent` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
