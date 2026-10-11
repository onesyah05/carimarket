-- AlterTable
ALTER TABLE `Transaction`
    ADD COLUMN `proofPath` VARCHAR(255) NULL,
    ADD COLUMN `proofMimeType` VARCHAR(100) NULL,
    ADD COLUMN `proofSize` INTEGER NULL,
    ADD COLUMN `proofUploadedAt` DATETIME(3) NULL;
