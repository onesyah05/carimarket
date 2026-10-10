import "server-only";
import { NotificationType, type Notification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMailer } from "@/server/integrations/email/mailer";

/**
 * Notifikasi dalam aplikasi.
 *
 * Notifikasi selalu disimpan di database agar pengguna melihatnya di dashboard.
 * Email hanya dicoba bila preferensi pengguna mengizinkan dan adapter email
 * sudah dikonfigurasi; kegagalan email tidak pernah menggagalkan notifikasi.
 */

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
};

export type SerializedNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const PREFERENCE_BY_TYPE: Record<NotificationType, "emailLead" | "emailReply" | "emailQuota"> = {
  LEAD_DISCOVERED: "emailLead",
  REPLY_SENT: "emailReply",
  REPLY_FAILED: "emailReply",
  MODERATION_DECISION: "emailReply",
  QUOTA_WARNING: "emailQuota",
};

export function serializeNotification(notification: Notification): SerializedNotification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function createNotification(input: NotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 191),
      body: input.body.slice(0, 500),
      href: input.href?.slice(0, 255) ?? null,
    },
  }).catch(() => null);

  if (notification) await sendEmailCopy(input).catch(() => undefined);
  return notification;
}

/**
 * Membuat notifikasi hanya bila belum ada notifikasi sejenis sejak `since`.
 * Dipakai untuk peringatan kuota agar tidak terkirim berulang setiap request.
 */
export async function createNotificationOnce(input: NotificationInput & { since: Date }) {
  const existing = await prisma.notification.findFirst({
    where: { userId: input.userId, type: input.type, title: input.title, createdAt: { gte: input.since } },
    select: { id: true },
  }).catch(() => null);
  if (existing) return null;
  return createNotification(input);
}

async function sendEmailCopy(input: NotificationInput) {
  const mailer = getMailer();
  if (!mailer.configured) return;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, emailIsPlaceholder: true, notification: true },
  });
  // Email placeholder berasal dari pendaftaran lewat Threads dan tidak dapat dihubungi.
  if (!user || user.emailIsPlaceholder) return;
  const preference = user.notification;
  if (preference && preference[PREFERENCE_BY_TYPE[input.type]] === false) return;

  await mailer.send({ to: user.email, subject: input.title, body: input.body });
}

export async function listNotifications(userId: string, take = 20) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return notifications.map(serializeNotification);
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return result.count;
}
