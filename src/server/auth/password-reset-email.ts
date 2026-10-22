/**
 * Isi email pengaturan ulang kata sandi.
 *
 * Dipisah dari pengiriman supaya dapat diuji tanpa jaringan, mengikuti pola
 * yang sama dengan email verifikasi. Versi teks selalu ikut karena sebagian
 * klien email memblokir HTML dan tautannya harus tetap terbaca.
 */

/** Umur tautan sengaja jauh lebih pendek dari verifikasi: ini membuka akun. */
export const PASSWORD_RESET_TTL_MINUTES = 60;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPasswordResetEmail(input: { name: string; link: string }) {
  const name = input.name.trim() || "Rekan Cari Market";
  const subject = "Pengaturan ulang kata sandi Cari Market";

  const body = [
    `Halo ${name},`,
    "",
    "Kami menerima permintaan pengaturan ulang kata sandi untuk akun Cari Market Anda. Buka tautan di bawah ini untuk membuat kata sandi baru.",
    "",
    input.link,
    "",
    `Tautan ini berlaku ${PASSWORD_RESET_TTL_MINUTES} menit dan hanya dapat dipakai sekali.`,
    "Setelah kata sandi diganti, semua sesi dan perangkat yang masuk sebelumnya akan dikeluarkan.",
    "",
    "Jika Anda tidak meminta ini, abaikan email ini. Kata sandi Anda tidak berubah selama tautannya tidak dibuka.",
    "",
    "— Tim Cari Market",
  ].join("\n");

  const html = `<!doctype html>
<html lang="id">
<body style="margin:0;padding:24px;background:#f6f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0b1739;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce4f0;border-radius:16px;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#516079;">Cari Market</p>
      <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Atur ulang kata sandi Anda</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Halo ${escapeHtml(name)}, kami menerima permintaan pengaturan ulang kata sandi untuk akun Anda.</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(input.link)}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#245bc7;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Buat kata sandi baru</a>
      </p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#516079;">Tombol tidak berfungsi? Salin tautan ini ke peramban Anda:<br><span style="word-break:break-all;color:#245bc7;">${escapeHtml(input.link)}</span></p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#516079;">Tautan berlaku ${PASSWORD_RESET_TTL_MINUTES} menit dan hanya dapat dipakai sekali. Setelah kata sandi diganti, seluruh sesi dan perangkat yang masuk sebelumnya dikeluarkan.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#516079;">Tidak meminta ini? Abaikan email ini — kata sandi Anda tidak berubah selama tautannya tidak dibuka.</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, body, html };
}

/**
 * Tautan absolut ke halaman pengaturan ulang. `NEXT_PUBLIC_APP_URL` dipakai apa
 * adanya supaya tautan tidak pernah ikut host dari permintaan masuk, yang
 * dapat dipalsukan.
 */
export function passwordResetLink(appUrl: string, token: string) {
  const url = new URL("/atur-ulang-sandi", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
