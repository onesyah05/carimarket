-- Satu akun kini boleh memiliki lebih dari satu jasa (profil bisnis).

-- Indeks unik userId dipakai foreign key ke User, jadi kuncinya dilepas dulu,
-- indeks pengganti dibuat, baru indeks uniknya dapat dihapus.
ALTER TABLE `BusinessProfile` DROP FOREIGN KEY `BusinessProfile_userId_fkey`;

-- CreateIndex
CREATE INDEX `BusinessProfile_userId_createdAt_idx` ON `BusinessProfile`(`userId`, `createdAt`);

-- DropIndex: batas satu profil per akun
DROP INDEX `BusinessProfile_userId_key` ON `BusinessProfile`;

-- AddForeignKey
ALTER TABLE `BusinessProfile` ADD CONSTRAINT `BusinessProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `businessProfileLimit` INTEGER NOT NULL DEFAULT 1;

-- Jatah jasa mengikuti katalog paket. Kode lain tetap pada bawaan 1, dan
-- harga maupun kuota paket yang sudah disetel Superadmin tidak disentuh.
UPDATE `Plan` SET `businessProfileLimit` = 3 WHERE `code` = 'BISNIS';
UPDATE `Plan` SET `businessProfileLimit` = 5 WHERE `code` = 'PRO';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `activeProfileId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Keyword` ADD COLUMN `businessProfileId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `businessProfileId` VARCHAR(191) NULL;

-- Backfill: setiap baris mengikuti profil tertua milik pemiliknya.
UPDATE `Keyword` k
    JOIN (SELECT userId, MIN(createdAt) AS firstAt FROM `BusinessProfile` GROUP BY userId) f ON f.userId = k.userId
    JOIN `BusinessProfile` b ON b.userId = f.userId AND b.createdAt = f.firstAt
    SET k.businessProfileId = b.id;

UPDATE `Lead` l
    JOIN (SELECT userId, MIN(createdAt) AS firstAt FROM `BusinessProfile` GROUP BY userId) f ON f.userId = l.userId
    JOIN `BusinessProfile` b ON b.userId = f.userId AND b.createdAt = f.firstAt
    SET l.businessProfileId = b.id;

-- DropIndex: keunikan lama berbasis akun
DROP INDEX `Keyword_userId_normalized_kind_key` ON `Keyword`;
DROP INDEX `Lead_userId_threadPostId_key` ON `Lead`;

-- CreateIndex: keunikan kini berbasis jasa
CREATE UNIQUE INDEX `Keyword_businessProfileId_normalized_kind_key` ON `Keyword`(`businessProfileId`, `normalized`, `kind`);
CREATE INDEX `Keyword_businessProfileId_isActive_idx` ON `Keyword`(`businessProfileId`, `isActive`);
CREATE UNIQUE INDEX `Lead_businessProfileId_threadPostId_key` ON `Lead`(`businessProfileId`, `threadPostId`);
CREATE INDEX `Lead_businessProfileId_status_discoveredAt_idx` ON `Lead`(`businessProfileId`, `status`, `discoveredAt`);

-- AddForeignKey
ALTER TABLE `Keyword` ADD CONSTRAINT `Keyword_businessProfileId_fkey` FOREIGN KEY (`businessProfileId`) REFERENCES `BusinessProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_businessProfileId_fkey` FOREIGN KEY (`businessProfileId`) REFERENCES `BusinessProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
