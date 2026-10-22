-- Penilaian AI atas kecocokan lead dengan bisnis pemiliknya.
-- Semua kolom nullable: baris lama tidak pernah dinilai, dan pencarian tetap
-- menyimpan lead meski penyedia AI sedang mati.
ALTER TABLE `Lead`
  ADD COLUMN `aiVerdict` ENUM('MATCH', 'NO_MATCH', 'UNSURE') NULL,
  ADD COLUMN `aiScore` SMALLINT NULL,
  ADD COLUMN `aiReason` VARCHAR(255) NULL,
  ADD COLUMN `aiModel` VARCHAR(100) NULL,
  ADD COLUMN `aiEvaluatedAt` DATETIME(3) NULL;

CREATE INDEX `Lead_businessProfileId_aiVerdict_discoveredAt_idx`
  ON `Lead`(`businessProfileId`, `aiVerdict`, `discoveredAt`);
