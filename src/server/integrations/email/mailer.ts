import "server-only";

/**
 * Adapter email.
 *
 * Belum ada provider yang dikonfigurasi, jadi implementasi aktif selalu
 * melaporkan `delivered: false` dengan alasan yang jelas. Pemanggil wajib
 * memperlakukan email sebagai saluran opsional: notifikasi dalam aplikasi
 * tetap tersimpan meskipun email tidak terkirim.
 *
 * Isi pesan tidak pernah dicatat ke log agar data pengguna tidak tersebar ke
 * output server.
 */

export type MailMessage = { to: string; subject: string; body: string };
export type MailResult = { delivered: boolean; reason?: string };

export interface Mailer {
  readonly configured: boolean;
  send(message: MailMessage): Promise<MailResult>;
}

export const unconfiguredMailer: Mailer = {
  configured: false,
  async send() {
    return { delivered: false, reason: "EMAIL_NOT_CONFIGURED" };
  },
};

/**
 * Mengembalikan adapter email yang aktif. Saat provider email ditambahkan,
 * kembalikan implementasinya di sini tanpa mengubah pemanggil.
 */
export function getMailer(): Mailer {
  return unconfiguredMailer;
}

export function isEmailConfigured() {
  return getMailer().configured;
}
