import { describe, expect, it } from "vitest";
import { classifyLeadIntent } from "./lead-intent";

describe("classifyLeadIntent", () => {
  it("mengenali permintaan jasa", () => {
    const samples = [
      "Lagi cari jasa pembuatan website buat toko online, ada rekomendasi?",
      "Aku butuh fotografer produk area Bandung, budget 500rb",
      "Minta rekomendasi kontraktor rumah dong kak",
      "Ada yang tau jasa desain logo yang bagus?",
      "Mau bikin aplikasi kasir, siapa yang bisa bantu?",
    ];
    for (const sample of samples) expect(classifyLeadIntent(sample), sample).toBe("mencari");
  });

  it("mengenali penawaran jasa", () => {
    // Dua contoh pertama diambil dari feed sungguhan yang dilaporkan.
    const samples = [
      "Halo kak aku bisa bantu kebetulan aku menyediakan jasa ketik & penyusunan laporan, dan terjangkau. Boleh banget DM kak",
      "Aku real kok, cuma nama nya begini krna emang akun buat cari job aja, kalau ada yg butuh jasa ketik, joki tugas, buat cv",
      "Open jasa pembuatan website, harga mulai 400 ribu include hosting",
      "Kami melayani renovasi rumah area Jabodetabek, free konsultasi",
      "Terima pesanan kue ulang tahun, ready setiap hari",
    ];
    for (const sample of samples) expect(classifyLeadIntent(sample), sample).toBe("menawarkan");
  });

  it("membiarkan postingan tanpa petunjuk sebagai belum jelas", () => {
    expect(classifyLeadIntent("Selamat pagi semuanya, semoga harinya lancar")).toBe("tidak jelas");
  });

  it("tidak terkecoh oleh kata butuh dalam kalimat penawaran", () => {
    expect(classifyLeadIntent("yang butuh jasa edit video boleh chat ya")).toBe("menawarkan");
  });

  it("tetap membaca permintaan meski menyebut harga", () => {
    expect(classifyLeadIntent("aku lagi butuh jasa desain, budget 300 ribu")).toBe("mencari");
  });

  it("tidak membedakan huruf besar kecil", () => {
    expect(classifyLeadIntent("LAGI CARI JASA DRONE UNTUK ACARA")).toBe("mencari");
  });

  it("menyebut belum jelas ketika kedua sisi seimbang", () => {
    // "butuh jasa" condong meminta, "jasa murah" condong menawarkan, bobotnya
    // sama besar — postingan seperti ini memang tidak layak dipaksa memihak.
    expect(classifyLeadIntent("butuh jasa, jasa murah")).toBe("tidak jelas");
  });
});
