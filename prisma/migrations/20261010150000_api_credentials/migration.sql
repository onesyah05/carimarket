-- CreateTable
CREATE TABLE `ApiCredential` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `name` VARCHAR(120) NOT NULL,
    `keyPrefix` VARCHAR(24) NOT NULL,
    `keyHash` VARCHAR(191) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApiCredential_keyHash_key`(`keyHash`),
    INDEX `ApiCredential_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `ApiCredential_keyPrefix_idx`(`keyPrefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApiCredential` ADD CONSTRAINT `ApiCredential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiCredential` ADD CONSTRAINT `ApiCredential_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

