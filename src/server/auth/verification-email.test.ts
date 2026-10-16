import { describe, expect, it } from "vitest";
import { VERIFICATION_TTL_HOURS, buildVerificationEmail, verificationLink } from "./verification-email";
import { registerSchema } from "./registration";

describe("verificationLink", () => {
  it("menempel token pada halaman verifikasi", () => {
    expect(verificationLink("https://carimarket.id", "abc123")).toBe("https://carimarket.id/verifikasi?token=abc123");
  });

  it("menyandikan token yang memuat karakter URL", () => {
    expect(verificationLink("https://carimarket.id", "a+b/c=")).toContain("token=a%2Bb%2Fc%3D");
  });

  it("mengabaikan path pada app URL agar tautan selalu absolut dari akar", () => {
    expect(verificationLink("https://carimarket.id/apa/saja", "t")).toBe("https://carimarket.id/verifikasi?token=t");
  });
});

describe("buildVerificationEmail", () => {
  const link = "https://carimarket.id/verifikasi?token=rahasia";

  it("memuat tautan di versi teks maupun HTML", () => {
    const mail = buildVerificationEmail({ name: "Nadia", link });
    expect(mail.body).toContain(link);
    expect(mail.html).toContain(link);
    expect(mail.subject).toBe("Verifikasi email Cari Market Anda");
  });

  it("menyebut masa berlaku tautan", () => {
    const mail = buildVerificationEmail({ name: "Nadia", link });
    expect(mail.body).toContain(`${VERIFICATION_TTL_HOURS} jam`);
  });

  it("memakai sapaan cadangan ketika nama kosong", () => {
    expect(buildVerificationEmail({ name: "   ", link }).body).toContain("Rekan Cari Market");
  });

  it("tidak meneruskan HTML dari nama pengguna", () => {
    const mail = buildVerificationEmail({ name: '<script>alert(1)</script>', link });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});

describe("registerSchema", () => {
  const valid = { name: "Nadia Pratama", email: "Nadia@Contoh.ID", password: "rahasia123", acceptTerms: true };

  it("merapikan nama dan menurunkan huruf email", () => {
    const parsed = registerSchema.safeParse({ ...valid, name: "  Nadia Pratama  " });
    expect(parsed.success && parsed.data).toMatchObject({ name: "Nadia Pratama", email: "nadia@contoh.id" });
  });

  it("menolak pendaftaran tanpa persetujuan syarat", () => {
    const parsed = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(parsed.success).toBe(false);
    expect(parsed.success || parsed.error.issues[0]?.message).toBe("Anda perlu menyetujui syarat dan kebijakan privasi.");
  });

  it("menolak kata sandi di bawah 8 karakter", () => {
    expect(registerSchema.safeParse({ ...valid, password: "pendek" }).success).toBe(false);
  });

  it("menolak email yang bukan email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "nadia(at)contoh" }).success).toBe(false);
  });
});
