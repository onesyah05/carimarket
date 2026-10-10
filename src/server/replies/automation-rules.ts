/**
 * Aturan keamanan mode `Balas otomatis` tanpa akses database.
 *
 * Worker memanggil fungsi ini saat membuat draft dan sekali lagi saat waktu
 * kirim tiba, jadi aturannya harus deterministik dan dapat diuji terpisah.
 */

export type QuietHoursSetting = {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

/** Jam tenang disimpan dan dievaluasi dalam UTC, sesuai salinan UI pengaturan. */
export function isWithinQuietHours(setting: QuietHoursSetting, now = new Date()) {
  if (!setting.quietHoursEnabled || !setting.quietHoursStart || !setting.quietHoursEnd) return false;
  const start = parseMinutes(setting.quietHoursStart);
  const end = parseMinutes(setting.quietHoursEnd);
  if (start === null || end === null || start === end) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
