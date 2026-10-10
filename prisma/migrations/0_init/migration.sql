-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `passwordHash` VARCHAR(255) NULL,
    `role` ENUM('SUPERADMIN', 'ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `status` ENUM('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `emailVerifiedAt` DATETIME(3) NULL,
    `emailIsPlaceholder` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `suspendedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_status_idx`(`role`, `status`),
    INDEX `User_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminPermission` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `permission` ENUM('SUPPORT_READ', 'SUPPORT_REPLY', 'MODERATION_REVIEW', 'CONTENT_DRAFT') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminPermission_permission_idx`(`permission`),
    UNIQUE INDEX `AdminPermission_userId_permission_key`(`userId`, `permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `ipHash` VARCHAR(191) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlacklistTerm` (
    `id` VARCHAR(191) NOT NULL,
    `term` VARCHAR(120) NOT NULL,
    `normalized` VARCHAR(120) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlacklistTerm_isActive_idx`(`isActive`),
    UNIQUE INDEX `BlacklistTerm_normalized_key`(`normalized`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `location` VARCHAR(140) NULL,
    `serviceArea` VARCHAR(255) NULL,
    `brandVoice` VARCHAR(100) NULL,
    `onboardingCompletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `emailLead` BOOLEAN NOT NULL DEFAULT true,
    `emailReply` BOOLEAN NOT NULL DEFAULT true,
    `emailQuota` BOOLEAN NOT NULL DEFAULT true,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `NotificationPreference_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReplyAutomationSetting` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mode` ENUM('REVIEW_FIRST', 'AUTO_SEND') NOT NULL DEFAULT 'REVIEW_FIRST',
    `minimumScore` INTEGER NOT NULL DEFAULT 90,
    `dailyLimit` INTEGER NOT NULL DEFAULT 10,
    `delayMinutes` INTEGER NOT NULL DEFAULT 15,
    `pauseOnRisk` BOOLEAN NOT NULL DEFAULT true,
    `quietHoursEnabled` BOOLEAN NOT NULL DEFAULT false,
    `quietHoursStart` VARCHAR(5) NULL,
    `quietHoursEnd` VARCHAR(5) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReplyAutomationSetting_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreadsConnection` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `externalAccountId` VARCHAR(191) NULL,
    `username` VARCHAR(100) NULL,
    `status` ENUM('PENDING', 'CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `capability` ENUM('LOCAL_DATA', 'SELF_ONLY', 'PUBLIC_SEARCH') NOT NULL DEFAULT 'LOCAL_DATA',
    `tokenCiphertext` TEXT NULL,
    `tokenIv` VARCHAR(255) NULL,
    `tokenAuthTag` VARCHAR(255) NULL,
    `tokenKeyVersion` INTEGER NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `scopes` JSON NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ThreadsConnection_externalAccountId_key`(`externalAccountId`),
    INDEX `ThreadsConnection_userId_status_idx`(`userId`, `status`),
    INDEX `ThreadsConnection_tokenExpiresAt_idx`(`tokenExpiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Keyword` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phrase` VARCHAR(120) NOT NULL,
    `normalized` VARCHAR(120) NOT NULL,
    `kind` ENUM('INCLUDE', 'EXCLUDE') NOT NULL DEFAULT 'INCLUDE',
    `frequency` ENUM('MANUAL', 'HOURLY', 'DAILY') NOT NULL DEFAULT 'HOURLY',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Keyword_userId_isActive_nextRunAt_idx`(`userId`, `isActive`, `nextRunAt`),
    UNIQUE INDEX `Keyword_userId_normalized_kind_key`(`userId`, `normalized`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SearchRun` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `keywordId` VARCHAR(191) NULL,
    `connectionId` VARCHAR(191) NULL,
    `capability` ENUM('LOCAL_DATA', 'SELF_ONLY', 'PUBLIC_SEARCH') NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `resultCount` INTEGER NOT NULL DEFAULT 0,
    `errorCode` VARCHAR(100) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SearchRun_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `SearchRun_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreadPost` (
    `id` VARCHAR(191) NOT NULL,
    `externalPostId` VARCHAR(191) NOT NULL,
    `authorHandle` VARCHAR(100) NOT NULL,
    `authorName` VARCHAR(140) NULL,
    `body` TEXT NOT NULL,
    `permalink` VARCHAR(512) NOT NULL,
    `likeCount` INTEGER NULL,
    `replyCount` INTEGER NULL,
    `repostCount` INTEGER NULL,
    `postedAt` DATETIME(3) NOT NULL,
    `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ThreadPost_externalPostId_key`(`externalPostId`),
    INDEX `ThreadPost_postedAt_idx`(`postedAt`),
    INDEX `ThreadPost_authorHandle_idx`(`authorHandle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `threadPostId` VARCHAR(191) NOT NULL,
    `status` ENUM('NEW', 'SAVED', 'REPLIED', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    `relevanceScore` DECIMAL(5, 2) NOT NULL,
    `matchReason` VARCHAR(255) NULL,
    `sourceMode` ENUM('LOCAL_DATA', 'SELF_ONLY', 'PUBLIC_SEARCH') NOT NULL,
    `discoveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_userId_status_discoveredAt_idx`(`userId`, `status`, `discoveredAt`),
    INDEX `Lead_relevanceScore_idx`(`relevanceScore`),
    UNIQUE INDEX `Lead_userId_threadPostId_key`(`userId`, `threadPostId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadKeywordMatch` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `keywordId` VARCHAR(191) NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,

    INDEX `LeadKeywordMatch_keywordId_idx`(`keywordId`),
    UNIQUE INDEX `LeadKeywordMatch_leadId_keywordId_key`(`leadId`, `keywordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReplyDraft` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'FLAGGED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'SENDING', 'SENT', 'SIMULATED_SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `deliveryMode` ENUM('REVIEW_FIRST', 'AUTO_SEND') NOT NULL DEFAULT 'REVIEW_FIRST',
    `aiModel` VARCHAR(100) NULL,
    `scheduledFor` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReplyDraft_userId_status_updatedAt_idx`(`userId`, `status`, `updatedAt`),
    INDEX `ReplyDraft_scheduledFor_status_idx`(`scheduledFor`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReplyDeliveryAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `replyDraftId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'FLAGGED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'SENDING', 'SENT', 'SIMULATED_SENT', 'FAILED', 'CANCELLED') NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `externalReplyId` VARCHAR(191) NULL,
    `errorCode` VARCHAR(100) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `attemptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ReplyDeliveryAttempt_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ReplyDeliveryAttempt_replyDraftId_attemptedAt_idx`(`replyDraftId`, `attemptedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModerationFlag` (
    `id` VARCHAR(191) NOT NULL,
    `replyDraftId` VARCHAR(191) NOT NULL,
    `ruleCode` VARCHAR(100) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ModerationFlag_resolvedAt_createdAt_idx`(`resolvedAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `monthlyPrice` DECIMAL(12, 2) NOT NULL,
    `monthlySearchLimit` INTEGER NOT NULL,
    `monthlyReplyLimit` INTEGER NOT NULL,
    `keywordLimit` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Plan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `status` ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'TRIAL',
    `providerReference` VARCHAR(191) NULL,
    `currentPeriodStart` DATETIME(3) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_providerReference_key`(`providerReference`),
    INDEX `Subscription_userId_status_idx`(`userId`, `status`),
    INDEX `Subscription_currentPeriodEnd_idx`(`currentPeriodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MonthlyUsage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `periodStart` DATE NOT NULL,
    `searchCount` INTEGER NOT NULL DEFAULT 0,
    `replyCount` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MonthlyUsage_userId_periodStart_key`(`userId`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageEvent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `units` INTEGER NOT NULL DEFAULT 1,
    `referenceId` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,

    INDEX `UsageEvent_userId_type_occurredAt_idx`(`userId`, `type`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    UNIQUE INDEX `Tag_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Article` (
    `id` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `excerpt` VARCHAR(500) NULL,
    `content` LONGTEXT NOT NULL,
    `coverImageUrl` VARCHAR(512) NULL,
    `metaTitle` VARCHAR(191) NULL,
    `metaDescription` VARCHAR(320) NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `scheduledFor` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Article_slug_key`(`slug`),
    INDEX `Article_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `Article_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArticleTag` (
    `articleId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `ArticleTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`articleId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupportTicket_status_priority_updatedAt_idx`(`status`, `priority`, `updatedAt`),
    INDEX `SupportTicket_requesterId_idx`(`requesterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportMessage` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupportMessage_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('LEAD_DISCOVERED', 'REPLY_SENT', 'REPLY_FAILED', 'MODERATION_DECISION', 'QUOTA_WARNING') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `href` VARCHAR(255) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(120) NOT NULL,
    `entityType` VARCHAR(100) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `ipHash` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `company` VARCHAR(140) NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContactSubmission_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlatformSecret` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `valueCiphertext` TEXT NOT NULL,
    `valueIv` VARCHAR(64) NOT NULL,
    `valueAuthTag` VARCHAR(64) NOT NULL,
    `valueKeyVersion` INTEGER NOT NULL DEFAULT 1,
    `note` VARCHAR(255) NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlatformSecret_key_key`(`key`),
    INDEX `PlatformSecret_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminPermission` ADD CONSTRAINT `AdminPermission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlacklistTerm` ADD CONSTRAINT `BlacklistTerm_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessProfile` ADD CONSTRAINT `BusinessProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReplyAutomationSetting` ADD CONSTRAINT `ReplyAutomationSetting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreadsConnection` ADD CONSTRAINT `ThreadsConnection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Keyword` ADD CONSTRAINT `Keyword_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SearchRun` ADD CONSTRAINT `SearchRun_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SearchRun` ADD CONSTRAINT `SearchRun_keywordId_fkey` FOREIGN KEY (`keywordId`) REFERENCES `Keyword`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SearchRun` ADD CONSTRAINT `SearchRun_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `ThreadsConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_threadPostId_fkey` FOREIGN KEY (`threadPostId`) REFERENCES `ThreadPost`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadKeywordMatch` ADD CONSTRAINT `LeadKeywordMatch_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadKeywordMatch` ADD CONSTRAINT `LeadKeywordMatch_keywordId_fkey` FOREIGN KEY (`keywordId`) REFERENCES `Keyword`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReplyDraft` ADD CONSTRAINT `ReplyDraft_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReplyDraft` ADD CONSTRAINT `ReplyDraft_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReplyDraft` ADD CONSTRAINT `ReplyDraft_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReplyDeliveryAttempt` ADD CONSTRAINT `ReplyDeliveryAttempt_replyDraftId_fkey` FOREIGN KEY (`replyDraftId`) REFERENCES `ReplyDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationFlag` ADD CONSTRAINT `ModerationFlag_replyDraftId_fkey` FOREIGN KEY (`replyDraftId`) REFERENCES `ReplyDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MonthlyUsage` ADD CONSTRAINT `MonthlyUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageEvent` ADD CONSTRAINT `UsageEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleTag` ADD CONSTRAINT `ArticleTag_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleTag` ADD CONSTRAINT `ArticleTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

