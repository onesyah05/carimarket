-- AlterTable
ALTER TABLE `ThreadPost`
    ADD COLUMN `isReply` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `replyToHandle` VARCHAR(100) NULL,
    ADD COLUMN `threadSize` INTEGER NULL;

-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `viewedAt` DATETIME(3) NULL;
