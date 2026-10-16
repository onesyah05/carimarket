/**
 * Isi email verifikasi pendaftaran.
 *
 * Dipisah dari pengiriman supaya dapat diuji tanpa jaringan, dan supaya satu
 * tempat saja yang menentukan kata-katanya. Versi teks selalu ikut: sebagian
 * klien email memblokir HTML, dan tautan verifikasi harus tetap terbaca.
 */

export const VERIFICATION_TTL_HOURS = 24;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildVerificationEmail(input: { name: string; link: string }) {
  const name = input.name.trim() || "Rekan Cari Market";
  const subject = "Verifikasi email Cari Market Anda";

  const body = [
    `Halo ${name},`,
    "",
    "Terima kasih sudah mendaftar di Cari Market. Satu langkah lagi: buka tautan di bawah ini untuk memverifikasi email Anda.",
    "",
    input.link,
    "",
    `Tautan ini berlaku ${VERIFICATION_TTL_HOURS} jam dan hanya dapat dipakai sekali.`,
    "Setelah terverifikasi, Anda akan diminta memilih paket langganan sebelum mulai memakai ruang kerja.",
    "",
    "Jika Anda tidak merasa mendaftar, abaikan email ini — akun tidak akan aktif tanpa verifikasi.",
    "",
    "— Tim Cari Market",
  ].join("\n");

  const html = `<!doctype html>
<html lang="id">
<body style="margin:0;padding:24px;background:#f6f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0b1739;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce4f0;border-radius:16px;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#516079;">Cari Market</p>
      <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Verifikasi email Anda</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Halo ${escapeHtml(name)}, terima kasih sudah mendaftar. Satu langkah lagi sebelum ruang kerja Anda terbuka.</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(input.link)}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#245bc7;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Verifikasi email</a>
      </p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#516079;">Tombol tidak berfungsi? Salin tautan ini ke peramban Anda:<br><span style="word-break:break-all;color:#245bc7;">${escapeHtml(input.link)}</span></p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#516079;">Tautan berlaku ${VERIFICATION_TTL_HOURS} jam dan hanya dapat dipakai sekali. Setelah terverifikasi, Anda akan diminta memilih paket langganan.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#516079;">Tidak merasa mendaftar? Abaikan email ini — akun tidak akan aktif tanpa verifikasi.</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, body, html };
}

/**
 * Tautan verifikasi absolut. `NEXT_PUBLIC_APP_URL` dipakai apa adanya supaya
 * tautan tidak pernah ikut host dari permintaan masuk, yang dapat dipalsukan.
 */
export function verificationLink(appUrl: string, token: string) {
  const url = new URL("/verifikasi", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
