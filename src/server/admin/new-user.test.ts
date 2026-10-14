import { describe, expect, it } from "vitest";
import { newUserSchema } from "./new-user";

function parse(input: Record<string, unknown>) {
  return newUserSchema.safeParse({ name: "Nadia Pratama", email: "nadia@langitvisual.id", password: "rahasia123", ...input });
}

describe("newUserSchema", () => {
  it("menerima isian yang lengkap", () => {
    expect(parse({}).success).toBe(true);
  });

  it("merapikan nama dan menurunkan huruf email", () => {
    const result = parse({ name: "  Nadia Pratama  ", email: "  Nadia@LangitVisual.ID " });
    expect(result.success && result.data).toEqual({
      name: "Nadia Pratama",
      email: "nadia@langitvisual.id",
      password: "rahasia123",
    });
  });

  it("menolak email tanpa bentuk yang sah", () => {
    const result = parse({ email: "nadia(at)langitvisual" });
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe("Format email tidak valid.");
  });

  it("menolak kata sandi di bawah 8 karakter", () => {
    const result = parse({ password: "rahasia" });
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe("Kata sandi minimal 8 karakter.");
  });

  it("tidak memangkas spasi di dalam kata sandi", () => {
    const result = parse({ password: " dua kata " });
    expect(result.success && result.data.password).toBe(" dua kata ");
  });

  it("menolak nama yang hanya spasi", () => {
    expect(parse({ name: "   " }).success).toBe(false);
  });

  it("menolak email yang melebihi panjang kolom", () => {
    expect(parse({ email: `${"a".repeat(185)}@contoh.id` }).success).toBe(false);
  });
});
