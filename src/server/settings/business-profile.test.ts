import { describe, expect, it } from "vitest";
import { hasCompleteBusinessProfile } from "./business-profile";

const complete = {
  name: "Langit Visual",
  category: "Jasa Drone",
  serviceArea: "Jabodetabek",
  description: "Dokumentasi udara untuk properti dan acara.",
};

describe("hasCompleteBusinessProfile", () => {
  it("menerima profil yang seluruh isinya terisi", () => {
    expect(hasCompleteBusinessProfile(complete)).toBe(true);
  });

  it("menolak profil yang belum ada", () => {
    expect(hasCompleteBusinessProfile(null)).toBe(false);
  });

  it("menolak area layanan kosong atau hanya spasi", () => {
    expect(hasCompleteBusinessProfile({ ...complete, serviceArea: null })).toBe(false);
    expect(hasCompleteBusinessProfile({ ...complete, serviceArea: "   " })).toBe(false);
  });

  it("menolak setiap kolom wajib yang kosong", () => {
    expect(hasCompleteBusinessProfile({ ...complete, name: "" })).toBe(false);
    expect(hasCompleteBusinessProfile({ ...complete, category: "" })).toBe(false);
    expect(hasCompleteBusinessProfile({ ...complete, description: " " })).toBe(false);
  });
});
