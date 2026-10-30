-- Jenis notifikasi khusus tiket dukungan.
--
-- Sebelumnya balasan tiket dikirim sebagai MODERATION_DECISION, yang terpetakan
-- ke preferensi email `emailReply`. Preferensi itu milik notifikasi balasan
-- Threads, jadi pengguna yang mematikannya ikut berhenti menerima jawaban
-- tiket dukungannya sendiri tanpa pernah diberi tahu.
--
-- Hanya menambah nilai di ujung enum: baris lama tidak tersentuh.
ALTER TABLE `Notification`
  MODIFY `type` ENUM(
    'LEAD_DISCOVERED',
    'REPLY_SENT',
    'REPLY_FAILED',
    'MODERATION_DECISION',
    'QUOTA_WARNING',
    'PAYMENT_UPDATE',
    'SUPPORT_UPDATE'
  ) NOT NULL;
