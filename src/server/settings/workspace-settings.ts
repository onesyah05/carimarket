import "server-only";
import { ReplyMode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Pengaturan workspace pengguna: profil bisnis, mode balasan, dan preferensi
 * notifikasi.
 *
 * Skema validasi dan bentuk keluarannya dipakai bersama oleh dashboard web dan
 * API mobile agar aturannya tidak pernah berbeda antar klien.
 */

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:MM (mis. 22:00).");

export const replyAutomationSchema = z.object({
  mode: z.enum(["review", "auto"]),
  minimumScore: z.number().int().min(70).max(100),
  dailyLimit: z.number().int().min(1).max(50),
  delayMinutes: z.number().int().refine(value => [5, 15, 30, 60].includes(value), "Jeda harus 5, 15, 30, atau 60 menit."),
  pauseOnRisk: z.boolean(),
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: timeSchema.nullable().default(null),
  quietHoursEnd: timeSchema.nullable().default(null),
}).refine(
  value => !value.quietHoursEnabled || (value.quietHoursStart !== null && value.quietHoursEnd !== null),
  { message: "Jam mulai dan jam selesai wajib diisi saat quiet hours aktif.", path: ["quietHoursStart"] },
);

export type ReplyAutomationInput = z.infer<typeof replyAutomationSchema>;

type ReplyAutomationRow = {
  mode: ReplyMode;
  minimumScore: number;
  dailyLimit: number;
  delayMinutes: number;
  pauseOnRisk: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

export function serializeReplyAutomation(settings: ReplyAutomationRow) {
  return {
    mode: settings.mode === ReplyMode.AUTO_SEND ? "auto" as const : "review" as const,
    minimumScore: settings.minimumScore,
    dailyLimit: settings.dailyLimit,
    delayMinutes: settings.delayMinutes,
    pauseOnRisk: settings.pauseOnRisk,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
  };
}

export const DEFAULT_REPLY_AUTOMATION = {
  mode: "review" as const,
  minimumScore: 90,
  dailyLimit: 10,
  delayMinutes: 15,
  pauseOnRisk: true,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

export async function getReplyAutomation(userId: string) {
  const settings = await prisma.replyAutomationSetting.findUnique({ where: { userId } });
  return settings ? serializeReplyAutomation(settings) : null;
}

export async function updateReplyAutomation(userId: string, input: ReplyAutomationInput) {
  const data = {
    mode: input.mode === "auto" ? ReplyMode.AUTO_SEND : ReplyMode.REVIEW_FIRST,
    minimumScore: input.minimumScore,
    dailyLimit: input.dailyLimit,
    delayMinutes: input.delayMinutes,
    pauseOnRisk: input.pauseOnRisk,
    quietHoursEnabled: input.quietHoursEnabled,
    // Jam tenang yang dimatikan tidak menyimpan sisa jam agar status tidak ambigu.
    quietHoursStart: input.quietHoursEnabled ? input.quietHoursStart : null,
    quietHoursEnd: input.quietHoursEnabled ? input.quietHoursEnd : null,
  };
  const settings = await prisma.replyAutomationSetting.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
  return serializeReplyAutomation(settings);
}

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Nama bisnis minimal 2 karakter.").max(140),
  category: z.string().trim().min(2, "Kategori minimal 2 karakter.").max(100),
  serviceArea: z.string().trim().min(2, "Area layanan minimal 2 karakter.").max(255),
  description: z.string().trim().min(2, "Deskripsi minimal 2 karakter.").max(5000),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export function serializeBusinessProfile(profile: { name: string; category: string; serviceArea: string | null; description: string } | null) {
  return {
    name: profile?.name ?? "",
    category: profile?.category ?? "",
    serviceArea: profile?.serviceArea ?? "",
    description: profile?.description ?? "",
  };
}

export async function getBusinessProfile(userId: string) {
  const profile = await prisma.businessProfile.findUnique({ where: { userId } });
  return { exists: Boolean(profile), profile: serializeBusinessProfile(profile) };
}

export async function updateBusinessProfile(userId: string, input: BusinessProfileInput) {
  const profile = await prisma.businessProfile.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
  return serializeBusinessProfile(profile);
}

export const notificationPreferenceSchema = z.object({
  emailLead: z.boolean(),
  emailReply: z.boolean(),
  emailQuota: z.boolean(),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceInput = { emailLead: true, emailReply: true, emailQuota: true };

export async function getNotificationPreferences(userId: string) {
  const preference = await prisma.notificationPreference.findUnique({ where: { userId } });
  return preference
    ? { emailLead: preference.emailLead, emailReply: preference.emailReply, emailQuota: preference.emailQuota }
    : DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function updateNotificationPreferences(userId: string, input: NotificationPreferenceInput) {
  const preference = await prisma.notificationPreference.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
  return { emailLead: preference.emailLead, emailReply: preference.emailReply, emailQuota: preference.emailQuota };
}
