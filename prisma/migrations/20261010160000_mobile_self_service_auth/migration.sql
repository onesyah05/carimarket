-- AlterTable
ALTER TABLE `ApiCredential` ADD COLUMN `source` ENUM('SUPERADMIN', 'USER_LOGIN', 'USER_PAIRING') NOT NULL DEFAULT 'SUPERADMIN';

-- CreateTable
CREATE TABLE `MobilePairingCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MobilePairingCode_codeHash_key`(`codeHash`),
    INDEX `MobilePairingCode_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ApiCredential_source_revokedAt_idx` ON `ApiCredential`(`source`, `revokedAt`);

-- AddForeignKey
ALTER TABLE `MobilePairingCode` ADD CONSTRAINT `MobilePairingCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

