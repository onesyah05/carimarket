import { describe, expect, it } from "vitest";
import { serializeProfile } from "./profiles";
import type { BusinessProfile } from "@prisma/client";

function profile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    id: "p1",
    userId: "u1",
    name: "Langit Visual",
    category: "Jasa Drone",
    description: "Dokumentasi udara",
    location: null,
    serviceArea: "Jabodetabek",
    brandVoice: null,
    onboardingCompletedAt: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  } as BusinessProfile;
}

describe("serializeProfile", () => {
  it("mengirim kolom yang dipakai pemilih jasa saja", () => {
    expect(serializeProfile(profile())).toEqual({
      id: "p1",
      name: "Langit Visual",
      category: "Jasa Drone",
      serviceArea: "Jabodetabek",
      description: "Dokumentasi udara",
      onboardingCompletedAt: null,
    });
  });

  it("tidak membocorkan userId ke klien", () => {
    expect(Object.keys(serializeProfile(profile()))).not.toContain("userId");
  });

  it("mengubah tanggal selesai onboarding menjadi ISO", () => {
    const done = profile({ onboardingCompletedAt: new Date("2026-10-05T07:00:00.000Z") });
    expect(serializeProfile(done).onboardingCompletedAt).toBe("2026-10-05T07:00:00.000Z");
  });
});
