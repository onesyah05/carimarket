-- Gambar QR milik satu metode pembayaran.
-- Tabel terpisah agar blob tidak ikut terbaca saat tagihan memuat metodenya
-- lewat relasi, dan di basis data (bukan di disk) agar tidak hilang tiap
-- deploy mengganti direktori aplikasi.
CREATE TABLE `PaymentMethodQr` (
  `paymentMethodId` VARCHAR(191) NOT NULL,
  `content` LONGBLOB NOT NULL,
  `mimeType` VARCHAR(80) NOT NULL,
  `size` INTEGER NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`paymentMethodId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PaymentMethodQr`
  ADD CONSTRAINT `PaymentMethodQr_paymentMethodId_fkey`
  FOREIGN KEY (`paymentMethodId`) REFERENCES `PaymentMethod`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
