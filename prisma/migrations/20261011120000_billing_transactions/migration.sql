-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('LEAD_DISCOVERED', 'REPLY_SENT', 'REPLY_FAILED', 'MODERATION_DECISION', 'QUOTA_WARNING', 'PAYMENT_UPDATE') NOT NULL;

-- CreateTable
CREATE TABLE `PaymentMethod` (
    `id` VARCHAR(191) NOT NULL,
    `channel` ENUM('BANK_TRANSFER', 'EWALLET', 'QRIS') NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `accountName` VARCHAR(120) NOT NULL,
    `accountNumber` VARCHAR(80) NOT NULL,
    `instructions` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentMethod_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(40) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'REVIEW', 'PAID', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `baseAmount` DECIMAL(12, 2) NOT NULL,
    `uniqueCode` INTEGER NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `periodMonths` INTEGER NOT NULL DEFAULT 1,
    `payerName` VARCHAR(120) NULL,
    `payerNote` VARCHAR(500) NULL,
    `reviewNote` VARCHAR(500) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Transaction_invoiceNumber_key`(`invoiceNumber`),
    INDEX `Transaction_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `Transaction_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Transaction_expiresAt_idx`(`expiresAt`),
    INDEX `Transaction_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `Transaction_planId_idx`(`planId`),
    INDEX `Transaction_reviewedById_idx`(`reviewedById`),
    INDEX `Transaction_subscriptionId_idx`(`subscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `PaymentMethod`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
