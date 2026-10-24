-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `role` ENUM('ADMIN', 'VERIFIER', 'CONTRIBUTOR') NOT NULL DEFAULT 'CONTRIBUTOR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'VERIFY', 'REJECT', 'SET_PREFERRED') NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` INTEGER UNSIGNED NOT NULL,
    `before_data` JSON NULL,
    `after_data` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sources` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` ENUM('BOOK', 'ARTICLE', 'CENSUS', 'ARCHIVE', 'WEBSITE', 'ORAL', 'OTHER') NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `author` VARCHAR(200) NULL,
    `publisher` VARCHAR(200) NULL,
    `year` SMALLINT NULL,
    `url` VARCHAR(500) NULL,
    `accessed_at` DATE NULL,
    `created_by` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sources_type_idx`(`type`),
    INDEX `sources_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `governorates` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name_ar` VARCHAR(100) NOT NULL,
    `name_en` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `governorates_name_ar_key`(`name_ar`),
    UNIQUE INDEX `governorates_name_en_key`(`name_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `municipalities` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `governorate_id` INTEGER UNSIGNED NOT NULL,
    `name_ar` VARCHAR(150) NOT NULL,
    `name_en` VARCHAR(150) NOT NULL,
    `type` ENUM('MUNICIPALITY', 'VILLAGE_COUNCIL', 'JOINT_COUNCIL') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `municipalities_governorate_id_name_ar_key`(`governorate_id`, `name_ar`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `villages` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name_ar` VARCHAR(150) NOT NULL,
    `name_en` VARCHAR(150) NOT NULL,
    `name_origin` TEXT NULL,
    `governorate_id` INTEGER UNSIGNED NOT NULL,
    `municipality_id` INTEGER UNSIGNED NULL,
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `location_description` TEXT NULL,
    `elevation_m` INTEGER NULL,
    `area_dunum` DECIMAL(10, 2) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `villages_governorate_id_name_ar_idx`(`governorate_id`, `name_ar`),
    INDEX `villages_municipality_id_idx`(`municipality_id`),
    INDEX `villages_latitude_longitude_idx`(`latitude`, `longitude`),
    INDEX `villages_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `village_names` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `language` ENUM('AR', 'EN', 'OTHER') NOT NULL,
    `type` ENUM('CURRENT', 'ENGLISH', 'HISTORICAL', 'TRANSLITERATION', 'ALTERNATIVE') NOT NULL,
    `period_note` VARCHAR(255) NULL,
    `source_id` INTEGER UNSIGNED NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `is_preferred` BOOLEAN NULL,
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `village_names_status_idx`(`status`),
    INDEX `village_names_source_id_idx`(`source_id`),
    INDEX `village_names_submitted_by_idx`(`submitted_by`),
    INDEX `village_names_verified_by_idx`(`verified_by`),
    UNIQUE INDEX `village_names_village_id_name_type_key`(`village_id`, `name`, `type`),
    UNIQUE INDEX `village_names_village_id_language_type_is_preferred_key`(`village_id`, `language`, `type`, `is_preferred`),
    FULLTEXT INDEX `village_names_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `village_relations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `related_village_id` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('SPLIT_FROM', 'MERGED_WITH', 'FORMERLY_PART_OF', 'OTHER') NOT NULL,
    `year` SMALLINT NULL,
    `source_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `village_relations_related_village_id_idx`(`related_village_id`),
    INDEX `village_relations_status_idx`(`status`),
    INDEX `village_relations_source_id_idx`(`source_id`),
    INDEX `village_relations_submitted_by_idx`(`submitted_by`),
    INDEX `village_relations_verified_by_idx`(`verified_by`),
    UNIQUE INDEX `village_relations_village_id_related_village_id_type_key`(`village_id`, `related_village_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `population_records` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `year` SMALLINT NOT NULL,
    `population` INTEGER UNSIGNED NOT NULL,
    `households` INTEGER UNSIGNED NULL,
    `notes` TEXT NULL,
    `source_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `is_preferred` BOOLEAN NULL,
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `population_records_status_idx`(`status`),
    INDEX `population_records_source_id_idx`(`source_id`),
    INDEX `population_records_submitted_by_idx`(`submitted_by`),
    INDEX `population_records_verified_by_idx`(`verified_by`),
    UNIQUE INDEX `population_records_village_id_year_source_id_key`(`village_id`, `year`, `source_id`),
    UNIQUE INDEX `population_records_village_id_year_is_preferred_key`(`village_id`, `year`, `is_preferred`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historical_events` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `category` ENUM('POLITICAL', 'SOCIAL', 'ECONOMIC', 'CULTURAL', 'NATURAL', 'OTHER') NOT NULL,
    `year_from` SMALLINT NOT NULL,
    `year_to` SMALLINT NULL,
    `date_precision` ENUM('EXACT', 'YEAR', 'DECADE', 'APPROXIMATE') NOT NULL,
    `source_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `historical_events_year_from_idx`(`year_from`),
    INDEX `historical_events_status_idx`(`status`),
    INDEX `historical_events_source_id_idx`(`source_id`),
    INDEX `historical_events_submitted_by_idx`(`submitted_by`),
    INDEX `historical_events_verified_by_idx`(`verified_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_villages` (
    `event_id` INTEGER UNSIGNED NOT NULL,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `note` VARCHAR(255) NULL,

    INDEX `event_villages_village_id_event_id_idx`(`village_id`, `event_id`),
    PRIMARY KEY (`event_id`, `village_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `landmarks` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `name_ar` VARCHAR(150) NOT NULL,
    `name_en` VARCHAR(150) NULL,
    `type` ENUM('MOSQUE', 'CHURCH', 'SHRINE', 'SPRING', 'ARCHAEOLOGICAL_SITE', 'OLD_BUILDING', 'NATURAL', 'OTHER') NOT NULL,
    `description` TEXT NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `period` VARCHAR(100) NULL,
    `current_condition` ENUM('GOOD', 'DAMAGED', 'DESTROYED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `source_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `landmarks_village_id_type_idx`(`village_id`, `type`),
    INDEX `landmarks_status_idx`(`status`),
    INDEX `landmarks_source_id_idx`(`source_id`),
    INDEX `landmarks_submitted_by_idx`(`submitted_by`),
    INDEX `landmarks_verified_by_idx`(`verified_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cultural_traits` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `category` ENUM('FOOD', 'CRAFT', 'DRESS', 'MUSIC_DANCE', 'FESTIVAL', 'DIALECT', 'CUSTOM', 'OTHER') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `source_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cultural_traits_village_id_category_idx`(`village_id`, `category`),
    INDEX `cultural_traits_status_idx`(`status`),
    INDEX `cultural_traits_source_id_idx`(`source_id`),
    INDEX `cultural_traits_submitted_by_idx`(`submitted_by`),
    INDEX `cultural_traits_verified_by_idx`(`verified_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `economic_activities` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('AGRICULTURE', 'LIVESTOCK', 'TRADE', 'CRAFT', 'INDUSTRY', 'TOURISM', 'SERVICES', 'OTHER') NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `importance` ENUM('MAIN', 'SECONDARY') NOT NULL,
    `year_from` SMALLINT NULL,
    `year_to` SMALLINT NULL,
    `source_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `economic_activities_village_id_type_idx`(`village_id`, `type`),
    INDEX `economic_activities_status_idx`(`status`),
    INDEX `economic_activities_source_id_idx`(`source_id`),
    INDEX `economic_activities_submitted_by_idx`(`submitted_by`),
    INDEX `economic_activities_verified_by_idx`(`verified_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `facilities` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `village_id` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('SCHOOL', 'CLINIC', 'HOSPITAL', 'POST_OFFICE', 'WATER_NETWORK', 'ELECTRICITY', 'COMMUNITY_CENTER', 'OTHER') NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('ACTIVE', 'CLOSED', 'PLANNED') NOT NULL,
    `year_established` SMALLINT NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `source_id` INTEGER UNSIGNED NOT NULL,
    `verification_status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submitted_by` INTEGER UNSIGNED NOT NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `verified_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `facilities_village_id_type_idx`(`village_id`, `type`),
    INDEX `facilities_verification_status_idx`(`verification_status`),
    INDEX `facilities_source_id_idx`(`source_id`),
    INDEX `facilities_submitted_by_idx`(`submitted_by`),
    INDEX `facilities_verified_by_idx`(`verified_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sources` ADD CONSTRAINT `sources_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `municipalities` ADD CONSTRAINT `municipalities_governorate_id_fkey` FOREIGN KEY (`governorate_id`) REFERENCES `governorates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `villages` ADD CONSTRAINT `villages_governorate_id_fkey` FOREIGN KEY (`governorate_id`) REFERENCES `governorates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `villages` ADD CONSTRAINT `villages_municipality_id_fkey` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `village_names` ADD CONSTRAINT `village_names_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `village_names` ADD CONSTRAINT `village_names_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `village_names` ADD CONSTRAINT `village_names_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `village_names` ADD CONSTRAINT `village_names_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `village_relations` ADD CONSTRAINT `village_relations_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `village_relations` ADD CONSTRAINT `village_relations_related_village_id_fkey` FOREIGN KEY (`related_village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `village_relations` ADD CONSTRAINT `village_relations_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `village_relations` ADD CONSTRAINT `village_relations_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `village_relations` ADD CONSTRAINT `village_relations_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `population_records` ADD CONSTRAINT `population_records_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `population_records` ADD CONSTRAINT `population_records_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `population_records` ADD CONSTRAINT `population_records_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `population_records` ADD CONSTRAINT `population_records_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_events` ADD CONSTRAINT `historical_events_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_events` ADD CONSTRAINT `historical_events_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_events` ADD CONSTRAINT `historical_events_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_villages` ADD CONSTRAINT `event_villages_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `historical_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_villages` ADD CONSTRAINT `event_villages_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `landmarks` ADD CONSTRAINT `landmarks_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `landmarks` ADD CONSTRAINT `landmarks_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `landmarks` ADD CONSTRAINT `landmarks_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `landmarks` ADD CONSTRAINT `landmarks_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cultural_traits` ADD CONSTRAINT `cultural_traits_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cultural_traits` ADD CONSTRAINT `cultural_traits_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cultural_traits` ADD CONSTRAINT `cultural_traits_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cultural_traits` ADD CONSTRAINT `cultural_traits_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `economic_activities` ADD CONSTRAINT `economic_activities_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `economic_activities` ADD CONSTRAINT `economic_activities_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `economic_activities` ADD CONSTRAINT `economic_activities_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `economic_activities` ADD CONSTRAINT `economic_activities_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_village_id_fkey` FOREIGN KEY (`village_id`) REFERENCES `villages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ─────────────────────────────────────────────────────────────
-- Hand-written additions (Prisma cannot express CHECK constraints)
-- ─────────────────────────────────────────────────────────────

-- Coordinates must be valid.
ALTER TABLE `villages`
  ADD CONSTRAINT `chk_villages_latitude`  CHECK (`latitude`  BETWEEN -90  AND 90),
  ADD CONSTRAINT `chk_villages_longitude` CHECK (`longitude` BETWEEN -180 AND 180);

-- A village cannot be related to itself.
ALTER TABLE `village_relations`
  ADD CONSTRAINT `chk_village_relations_not_self` CHECK (`village_id` <> `related_village_id`);

-- Year ranges must not go backwards.
ALTER TABLE `historical_events`
  ADD CONSTRAINT `chk_historical_events_years` CHECK (`year_to` IS NULL OR `year_to` >= `year_from`);
ALTER TABLE `economic_activities`
  ADD CONSTRAINT `chk_economic_activities_years` CHECK (`year_to` IS NULL OR `year_to` >= `year_from`);

-- "Preferred" is stored as 1 or NULL, never 0, so the unique index allows only one preferred row per group.
ALTER TABLE `population_records`
  ADD CONSTRAINT `chk_population_records_preferred` CHECK (`is_preferred` IS NULL OR `is_preferred` = 1);
ALTER TABLE `village_names`
  ADD CONSTRAINT `chk_village_names_preferred` CHECK (`is_preferred` IS NULL OR `is_preferred` = 1);
