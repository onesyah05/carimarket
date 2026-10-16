import "server-only";
import { mailFrom, resendMailer } from "./resend-mailer";

/**
 * Adapter email.
 *
 * Provider aktif bila `RESEND_API_KEY` terisi; tanpa itu adapter melaporkan
 * `delivered: false` dengan alasan yang jelas. Pemanggil tetap wajib
 * memperlakukan email sebagai saluran yang bisa gagal: notifikasi dalam
 * aplikasi tetap tersimpan meskipun email tidak terkirim, dan verifikasi
 * pendaftaran menyediakan tombol kirim ulang.
 *
 * Isi pesan tidak pernah dicatat ke log agar data pengguna tidak tersebar ke
 * output server.
 */

export type MailMessage = { to: string; subject: string; body: string; html?: string };
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
 * Mengembalikan adapter email yang aktif. Dibuat ulang tiap panggilan supaya
 * perubahan env saat restart langsung berlaku tanpa cache tersembunyi.
 */
export function getMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return apiKey ? resendMailer(apiKey, mailFrom()) : unconfiguredMailer;
}

export function isEmailConfigured() {
  return getMailer().configured;
}
