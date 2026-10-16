import "server-only";
import type { Mailer, MailMessage, MailResult } from "./mailer";

/**
 * Pengiriman email lewat Resend.
 *
 * Dipanggil langsung ke REST API-nya, bukan lewat SDK, mengikuti cara
 * integrasi lain di proyek ini memanggil Meta: satu dependensi lebih sedikit
 * dan bentuk permintaannya terlihat apa adanya.
 *
 * Yang tidak pernah masuk log: API key, alamat tujuan, dan isi pesan. Saat
 * gagal, yang dicatat hanya kode status dan pesan singkat dari Resend supaya
 * masalah pengiriman tetap dapat didiagnosis.
 */

const ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Cari Market <noreply@carimarket.id>";

export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    configured: true,
    async send(message: MailMessage): Promise<MailResult> {
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.body,
            ...(message.html ? { html: message.html } : {}),
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        console.warn("Pengiriman email gagal: tidak dapat menghubungi Resend.");
        return { delivered: false, reason: "EMAIL_PROVIDER_UNREACHABLE" };
      }

      if (response.ok) return { delivered: true };

      const payload = (await response.json().catch(() => null)) as { message?: unknown; name?: unknown } | null;
      const detail = typeof payload?.message === "string" ? payload.message.slice(0, 160) : "tanpa pesan";
      console.warn(`Pengiriman email ditolak Resend: http=${response.status} pesan="${detail}"`);
      return { delivered: false, reason: `EMAIL_REJECTED_${response.status}` };
    },
  };
}

/** Alamat pengirim dari env, dengan bawaan noreply@carimarket.id. */
export function mailFrom() {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}
