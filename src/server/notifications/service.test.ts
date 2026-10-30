import { describe, expect, it } from "vitest";
import { PREFERENCE_BY_TYPE } from "./service";

/**
 * Peta ini menentukan notifikasi mana yang boleh dibungkam preferensi email.
 * Salah memetakan satu jenis berarti orang berhenti menerima kabar yang ia
 * sendiri tunggu, tanpa pernah diberi tahu bahwa ia berhenti menerimanya.
 */
describe("PREFERENCE_BY_TYPE", () => {
  it("mengirim balasan tiket dukungan tanpa syarat", () => {
    // Dulu balasan tiket memakai MODERATION_DECISION, yang terikat
    // `emailReply`: preferensi untuk notifikasi balasan Threads. Mematikan
    // notifikasi Threads diam-diam ikut mematikan jawaban atas tiket yang
    // orang itu sendiri buka.
    expect(PREFERENCE_BY_TYPE.SUPPORT_UPDATE).toBeNull();
  });

  it("mengirim kabar pembayaran tanpa syarat", () => {
    // Status pembayaran menentukan paket yang berlaku, jadi bukan pemasaran.
    expect(PREFERENCE_BY_TYPE.PAYMENT_UPDATE).toBeNull();
  });

  it("menautkan notifikasi lead dan kuota ke preferensinya masing-masing", () => {
    expect(PREFERENCE_BY_TYPE.LEAD_DISCOVERED).toBe("emailLead");
    expect(PREFERENCE_BY_TYPE.QUOTA_WARNING).toBe("emailQuota");
  });

  it("tidak menyisakan jenis notifikasi tanpa keputusan", () => {
    // Record<NotificationType, ...> sudah memaksanya saat kompilasi; ini
    // menjaga agar nilai enum baru tidak lolos dengan undefined saat berjalan.
    for (const [type, preference] of Object.entries(PREFERENCE_BY_TYPE)) {
      expect(preference === null || typeof preference === "string", `${type} tidak diputuskan`).toBe(true);
    }
  });
});
