/**
 * Uji asap API mobile terhadap aplikasi yang sedang berjalan.
 *
 * Alurnya: menerbitkan kredensial sementara, memanggil endpoint yang hanya
 * membaca data, memastikan kunci asing ditolak, lalu mencabut kredensial itu
 * kembali. Tidak ada endpoint yang mengubah data workspace atau memakai kuota
 * yang dipanggil, dan nilai kunci tidak pernah dicetak.
 *
 * Jalankan: npm run api:smoke -- https://carimarket.id
 */
import { prisma } from "@/lib/prisma";
import { issueCredential, revokeCredential } from "@/server/api/credentials";
import { createPairingCode } from "@/server/api/mobile-auth";

const baseUrl = (process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const READ_ONLY_PATHS = [
  "/api/v1/me",
  "/api/v1/me/overview",
  "/api/v1/me/subscription",
  "/api/v1/me/threads",
  "/api/v1/me/keywords",
  "/api/v1/me/leads?perPage=2",
  "/api/v1/me/replies?perPage=2",
  "/api/v1/me/notifications?limit=5",
  "/api/v1/me/reply-automation",
  "/api/v1/me/business-profile",
  "/api/v1/me/notification-preferences",
  "/api/v1/me/devices",
];

type Check = { label: string; ok: boolean; detail: string };

async function call(path: string, key: string | null, init?: { method?: string; body?: unknown }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as
    | { success?: boolean; data?: unknown; error?: { code?: string }; meta?: { requestId?: string; timestamp?: string; page?: unknown } }
    | null;
  return { status: response.status, payload, requestIdHeader: response.headers.get("x-request-id") };
}

/** Amplop wajib sama di semua endpoint; inilah yang diperiksa di sini. */
function envelopeIssues(payload: unknown, expectSuccess: boolean): string[] {
  const issues: string[] = [];
  const body = payload as { success?: unknown; data?: unknown; error?: { code?: unknown; message?: unknown; details?: unknown }; meta?: { requestId?: unknown; timestamp?: unknown } } | null;
  if (!body) return ["respons bukan JSON"];
  if (body.success !== expectSuccess) issues.push(`success bukan ${expectSuccess}`);
  if (typeof body.meta?.requestId !== "string") issues.push("meta.requestId hilang");
  if (typeof body.meta?.timestamp !== "string") issues.push("meta.timestamp hilang");
  if (expectSuccess) {
    if (body.data === undefined) issues.push("data hilang");
    if (body.error !== undefined) issues.push("error ikut terkirim pada respons sukses");
  } else {
    if (typeof body.error?.code !== "string") issues.push("error.code hilang");
    if (typeof body.error?.message !== "string") issues.push("error.message hilang");
    if (!("details" in (body.error ?? {}))) issues.push("error.details hilang");
    if (body.data !== undefined) issues.push("data ikut terkirim pada respons gagal");
  }
  return issues;
}

async function main() {
  const checks: Check[] = [];

  const [superadmin, target] = await Promise.all([
    prisma.user.findFirst({ where: { role: "SUPERADMIN" } }),
    prisma.user.findFirst({ where: { role: "USER", status: "ACTIVE", deletedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!superadmin) throw new Error("Tidak ada akun SUPERADMIN untuk menerbitkan kredensial.");
  if (!target) throw new Error("Tidak ada akun pengguna aktif untuk diuji.");

  console.log(`Basis URL     : ${baseUrl}`);
  console.log(`Workspace uji : ${target.email}`);

  const issued = await issueCredential({
    actor: superadmin,
    userId: target.id,
    name: `Uji asap ${new Date().toISOString().slice(0, 16)}`,
    expiresInDays: 1,
  });

  try {
    // 1. Tanpa kredensial harus 401 dengan amplop error yang benar.
    const anonymous = await call("/api/v1/me", null);
    checks.push({
      label: "tanpa kunci ditolak 401",
      ok: anonymous.status === 401 && anonymous.payload?.error?.code === "UNAUTHENTICATED" && envelopeIssues(anonymous.payload, false).length === 0,
      detail: `status ${anonymous.status}, kode ${anonymous.payload?.error?.code ?? "-"}`,
    });

    // 2. Kunci asing ditolak tanpa membocorkan keberadaan kunci lain.
    const foreign = await call("/api/v1/me", "cmk_deadbeef_" + "0".repeat(64));
    checks.push({
      label: "kunci asing ditolak 401",
      ok: foreign.status === 401 && foreign.payload?.error?.code === "UNAUTHENTICATED",
      detail: `status ${foreign.status}, kode ${foreign.payload?.error?.code ?? "-"}`,
    });

    // 3. Seluruh endpoint baca harus 200 dengan amplop seragam.
    for (const path of READ_ONLY_PATHS) {
      const result = await call(path, issued.key);
      const issues = envelopeIssues(result.payload, true);
      const headerOk = result.requestIdHeader === (result.payload?.meta?.requestId ?? null);
      checks.push({
        label: `GET ${path}`,
        ok: result.status === 200 && issues.length === 0 && headerOk,
        detail: result.status === 200
          ? (issues.length === 0 ? (headerOk ? "amplop sesuai" : "X-Request-Id tidak cocok dengan meta.requestId") : issues.join("; "))
          : `status ${result.status}, kode ${result.payload?.error?.code ?? "-"}`,
      });
    }

    // 4. Endpoint daftar wajib menyertakan meta.page.
    const leads = await call("/api/v1/me/leads?perPage=2", issued.key);
    checks.push({
      label: "daftar menyertakan meta.page",
      ok: Boolean(leads.payload?.meta?.page),
      detail: leads.payload?.meta?.page ? JSON.stringify(leads.payload.meta.page) : "meta.page hilang",
    });

    // 5. Validasi parameter mengembalikan INVALID_INPUT, bukan 500.
    const invalid = await call("/api/v1/me/leads?status=SALAH", issued.key);
    checks.push({
      label: "parameter salah ditolak INVALID_INPUT",
      ok: invalid.status === 400 && invalid.payload?.error?.code === "INVALID_INPUT",
      detail: `status ${invalid.status}, kode ${invalid.payload?.error?.code ?? "-"}`,
    });

    // 6. Alur pemasangan mandiri: kode dari dashboard ditukar menjadi token.
    const pairing = await createPairingCode(target);
    const paired = await call("/api/v1/auth/pair", null, { method: "POST", body: { code: pairing.code, deviceName: "Perangkat uji asap" } });
    const pairedToken = (paired.payload?.data as { token?: string } | undefined)?.token ?? null;
    checks.push({
      label: "kode pemasangan ditukar menjadi token",
      ok: paired.status === 201 && typeof pairedToken === "string" && envelopeIssues(paired.payload, true).length === 0,
      detail: `status ${paired.status}, token ${pairedToken ? "diterima" : "tidak ada"}`,
    });

    if (pairedToken) {
      const withPaired = await call("/api/v1/me", pairedToken);
      checks.push({
        label: "token hasil pemasangan dapat dipakai",
        ok: withPaired.status === 200 && withPaired.payload?.success === true,
        detail: `status ${withPaired.status}`,
      });

      // Kode hanya sekali pakai.
      const reused = await call("/api/v1/auth/pair", null, { method: "POST", body: { code: pairing.code } });
      checks.push({
        label: "kode pemasangan tidak dapat dipakai dua kali",
        ok: reused.status === 409 && reused.payload?.error?.code === "PAIRING_CODE_USED",
        detail: `status ${reused.status}, kode ${reused.payload?.error?.code ?? "-"}`,
      });

      const loggedOut = await call("/api/v1/auth/logout", pairedToken, { method: "POST" });
      const afterLogout = await call("/api/v1/me", pairedToken);
      checks.push({
        label: "keluar mencabut token perangkat",
        ok: loggedOut.status === 200 && afterLogout.status === 401 && afterLogout.payload?.error?.code === "CREDENTIAL_REVOKED",
        detail: `logout ${loggedOut.status}, pemakaian berikutnya ${afterLogout.status}/${afterLogout.payload?.error?.code ?? "-"}`,
      });
    }

    // 7. Kode pemasangan asal ditolak.
    const badCode = await call("/api/v1/auth/pair", null, { method: "POST", body: { code: "ZZZZ-9999" } });
    checks.push({
      label: "kode pemasangan asing ditolak",
      ok: badCode.status === 400 && badCode.payload?.error?.code === "PAIRING_CODE_INVALID",
      detail: `status ${badCode.status}, kode ${badCode.payload?.error?.code ?? "-"}`,
    });

    // 8. Masuk dengan kata sandi: akun tanpa kata sandi harus dijawab jelas.
    const login = await call("/api/v1/auth/login", null, { method: "POST", body: { email: target.email, password: "sandi-yang-salah-sekali" } });
    const expectedLoginCode = target.passwordHash ? "INVALID_CREDENTIALS" : "PASSWORD_NOT_SET";
    checks.push({
      label: `masuk tanpa kredensial benar ditolak ${expectedLoginCode}`,
      ok: login.payload?.error?.code === expectedLoginCode,
      detail: `status ${login.status}, kode ${login.payload?.error?.code ?? "-"}`,
    });

    // 9. Email tidak terdaftar tidak boleh dibedakan dari kata sandi salah.
    const unknown = await call("/api/v1/auth/login", null, { method: "POST", body: { email: "tidak-ada@contoh.invalid", password: "apa-saja-panjang" } });
    checks.push({
      label: "email tidak terdaftar ditolak INVALID_CREDENTIALS",
      ok: unknown.payload?.error?.code === "INVALID_CREDENTIALS",
      detail: `status ${unknown.status}, kode ${unknown.payload?.error?.code ?? "-"}`,
    });

    // 10. Endpoint internal tidak boleh terbuka untuk kunci API.
    const internal = await call("/api/admin/api-credentials", issued.key);
    checks.push({
      label: "endpoint admin tidak dapat diakses kunci API",
      ok: internal.status === 401 || internal.status === 403,
      detail: `status ${internal.status}`,
    });
  } finally {
    const revoked = await revokeCredential(superadmin, issued.id);
    checks.push({ label: "kredensial uji dicabut kembali", ok: revoked, detail: revoked ? "dicabut" : "gagal mencabut" });

    // 7. Setelah dicabut, kunci yang sama harus ditolak.
    const afterRevoke = await call("/api/v1/me", issued.key);
    checks.push({
      label: "kunci tercabut ditolak",
      ok: afterRevoke.status === 401 && afterRevoke.payload?.error?.code === "CREDENTIAL_REVOKED",
      detail: `status ${afterRevoke.status}, kode ${afterRevoke.payload?.error?.code ?? "-"}`,
    });
  }

  console.log("");
  for (const check of checks) {
    console.log(`${check.ok ? "OK  " : "GAGAL"} ${check.label.padEnd(46)} ${check.detail}`);
  }

  const failed = checks.filter(check => !check.ok);
  console.log("");
  console.log(failed.length === 0 ? `Semua ${checks.length} pemeriksaan lulus.` : `${failed.length} dari ${checks.length} pemeriksaan gagal.`);
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error("Uji asap gagal:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
