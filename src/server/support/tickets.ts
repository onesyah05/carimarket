import "server-only";
import { TicketPriority, TicketStatus, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { createNotification } from "@/server/notifications/service";

/**
 * Tiket dukungan.
 *
 * Modelnya sudah lama ada dan tampil di panel Admin, tetapi tidak ada satu pun
 * jalur yang menulisnya: pengguna tidak dapat membuat tiket dan staf tidak
 * dapat membalas. Modul ini melengkapi kedua arahnya dengan satu aturan
 * bersama, supaya daftar di panel internal dan daftar di dashboard pengguna
 * tidak pernah menunjukkan keadaan yang berbeda.
 *
 * Catatan internal (`isInternal`) tidak pernah ikut ke pengguna. Itu ruang
 * staf untuk mencatat konteks penanganan tanpa membuka percakapan baru.
 */

const MAX_OPEN_TICKETS = 5;

export const newTicketSchema = z.object({
  subject: z.string().trim().min(5, "Judul minimal 5 karakter.").max(191),
  body: z.string().trim().min(20, "Jelaskan kendala Anda minimal 20 karakter agar dapat kami tindak lanjuti.").max(4_000),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
});

export const ticketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(2, "Pesan tidak boleh kosong.").max(4_000),
});

export const staffReplySchema = ticketReplySchema.extend({
  isInternal: z.boolean().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignToMe: z.boolean().optional(),
});

export type NewTicketInput = z.infer<typeof newTicketSchema>;
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;
export type StaffReplyInput = z.infer<typeof staffReplySchema>;

export type TicketMessage = {
  id: string;
  body: string;
  authorName: string;
  fromStaff: boolean;
  isInternal: boolean;
  createdAt: string;
};

export type TicketSummary = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketDetail = TicketSummary & {
  requesterName: string;
  requesterEmail: string | null;
  assigneeName: string | null;
  messages: TicketMessage[];
};

/** Status yang masih menunggu tindakan salah satu pihak. */
const OPEN_STATUSES = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_USER];

type TicketRow = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  updatedAt: Date;
  _count?: { messages: number };
};

function toSummary(row: TicketRow, lastMessageAt?: Date | null): TicketSummary {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    messageCount: row._count?.messages ?? 0,
    lastMessageAt: lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessage(message: {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  author: { name: string; role: User["role"] };
}): TicketMessage {
  return {
    id: message.id,
    body: message.body,
    authorName: message.author.name,
    fromStaff: message.author.role !== "USER",
    isInternal: message.isInternal,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Membuat tiket baru beserta pesan pertamanya.
 *
 * Batas tiket terbuka ada supaya satu akun tidak membanjiri antrean dukungan
 * dengan tiket kembar; menutup atau menyelesaikan tiket membuka ruang lagi.
 */
export async function createTicket(user: User, input: NewTicketInput): Promise<TicketDetail> {
  const open = await prisma.supportTicket.count({
    where: { requesterId: user.id, status: { in: OPEN_STATUSES } },
  });
  if (open >= MAX_OPEN_TICKETS) {
    throw new ThreadsIntegrationError(
      "TICKET_LIMIT_REACHED",
      `Anda memiliki ${open} tiket yang masih berjalan. Lanjutkan percakapan di tiket yang ada, atau tutup dulu yang sudah selesai.`,
      409,
    );
  }

  const ticket = await prisma.$transaction(async transaction => {
    const created = await transaction.supportTicket.create({
      data: {
        requesterId: user.id,
        subject: input.subject,
        priority: (input.priority ?? "NORMAL") as TicketPriority,
        status: TicketStatus.OPEN,
      },
    });
    await transaction.supportMessage.create({
      data: { ticketId: created.id, authorId: user.id, body: input.body },
    });
    return created;
  });

  await recordAudit({
    actorId: user.id,
    action: "SUPPORT_TICKET_CREATED",
    entityType: "SupportTicket",
    entityId: ticket.id,
    metadata: { priority: ticket.priority },
  });

  await notifyStaff(
    "Tiket dukungan baru",
    `${user.name ?? user.email} membuka tiket "${input.subject}".`,
  );

  return requireTicketForUser(user.id, ticket.id);
}

/**
 * Memberi tahu staf bahwa ada tiket yang menunggu.
 *
 * Sebelumnya tidak ada apa pun yang mengabari tim: tiket hanya terlihat kalau
 * seseorang kebetulan membuka konsolnya. Pengguna sudah diberi tahu saat
 * dijawab, tapi arah sebaliknya diam sepenuhnya, jadi tiket bisa menginap
 * tanpa ada yang tahu.
 *
 * Kegagalan di sini tidak boleh menggagalkan pembuatan tiket: tiketnya sudah
 * tersimpan, dan kehilangan pemberitahuan lebih ringan daripada menolak
 * permintaan bantuan yang sudah berhasil masuk.
 */
async function notifyStaff(title: string, body: string) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPERADMIN"] }, deletedAt: null },
    select: { id: true, role: true },
  }).catch(() => []);

  await Promise.all(staff.map(member => createNotification({
    userId: member.id,
    type: "SUPPORT_UPDATE",
    title,
    body,
    // Tiap orang dibawa ke konsol miliknya sendiri. Superadmin memang boleh
    // membuka /admin, tapi mendarat di sidebar yang bukan miliknya membuat
    // orang mengira ia salah masuk.
    href: member.role === "SUPERADMIN" ? "/superadmin/tiket" : "/admin/tiket",
  }).catch(() => undefined)));
}

export async function listMyTickets(userId: string): Promise<TicketSummary[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { requesterId: userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      _count: { select: { messages: { where: { isInternal: false } } } },
      messages: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  return rows.map(row => toSummary(row, row.messages[0]?.createdAt));
}

/** Detail tiket milik pengguna. Catatan internal staf disaring di query, bukan di tampilan. */
export async function requireTicketForUser(userId: string, ticketId: string): Promise<TicketDetail> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, requesterId: userId },
    include: {
      _count: { select: { messages: { where: { isInternal: false } } } },
      requester: { select: { name: true, email: true, emailIsPlaceholder: true } },
      assignee: { select: { name: true } },
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, role: true } } },
      },
    },
  });
  if (!ticket) throw new ThreadsIntegrationError("TICKET_NOT_FOUND", "Tiket tidak ditemukan.", 404);

  return {
    ...toSummary(ticket, ticket.messages.at(-1)?.createdAt),
    requesterName: ticket.requester.name,
    requesterEmail: ticket.requester.emailIsPlaceholder ? null : ticket.requester.email,
    assigneeName: ticket.assignee?.name ?? null,
    messages: ticket.messages.map(toMessage),
  };
}

/**
 * Balasan dari pemilik tiket.
 *
 * Tiket yang sudah ditutup tidak dibuka ulang oleh balasan: itu membuat
 * antrean staf berisi percakapan yang sudah selesai berbulan-bulan lalu.
 * Tiket yang baru diselesaikan masih dapat dilanjutkan.
 */
export async function replyAsUser(user: User, input: TicketReplyInput): Promise<TicketDetail> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: input.ticketId, requesterId: user.id },
    select: { id: true, status: true },
  });
  if (!ticket) throw new ThreadsIntegrationError("TICKET_NOT_FOUND", "Tiket tidak ditemukan.", 404);
  if (ticket.status === TicketStatus.CLOSED) {
    throw new ThreadsIntegrationError(
      "TICKET_CLOSED",
      "Tiket ini sudah ditutup. Buat tiket baru agar permintaan Anda masuk antrean.",
      409,
    );
  }

  // Bola kembali ke staf: tiket yang sedang menunggu pengguna tidak boleh
  // tetap berstatus menunggu setelah penggunanya menjawab.
  const reopened = ticket.status === TicketStatus.WAITING_USER || ticket.status === TicketStatus.RESOLVED;

  await prisma.$transaction(async transaction => {
    await transaction.supportMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, body: input.body },
    });
    await transaction.supportTicket.update({
      where: { id: ticket.id },
      data: { status: reopened ? TicketStatus.OPEN : ticket.status },
    });
  });

  await notifyStaff(
    "Balasan baru pada tiket",
    `${user.name ?? user.email} membalas tiket yang sedang berjalan.`,
  );

  return requireTicketForUser(user.id, ticket.id);
}

/** Pengguna menutup tiketnya sendiri setelah merasa selesai. */
export async function closeTicketAsUser(user: User, ticketId: string): Promise<TicketDetail> {
  const updated = await prisma.supportTicket.updateMany({
    where: { id: ticketId, requesterId: user.id, status: { not: TicketStatus.CLOSED } },
    data: { status: TicketStatus.CLOSED },
  });
  if (!updated.count) throw new ThreadsIntegrationError("TICKET_NOT_FOUND", "Tiket tidak ditemukan atau sudah ditutup.", 404);
  await recordAudit({ actorId: user.id, action: "SUPPORT_TICKET_CLOSED", entityType: "SupportTicket", entityId: ticketId });
  return requireTicketForUser(user.id, ticketId);
}

export type InternalTicketSummary = TicketSummary & {
  requesterName: string;
  requesterEmail: string | null;
  assigneeName: string | null;
  waitingOnStaff: boolean;
};

export async function listTicketsForInternal(): Promise<InternalTicketSummary[]> {
  const rows = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      _count: { select: { messages: true } },
      requester: { select: { name: true, email: true, emailIsPlaceholder: true } },
      assignee: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, author: { select: { role: true } } },
      },
    },
  });

  return rows.map(row => ({
    ...toSummary(row, row.messages[0]?.createdAt),
    requesterName: row.requester.name,
    requesterEmail: row.requester.emailIsPlaceholder ? null : row.requester.email,
    assigneeName: row.assignee?.name ?? null,
    // Pesan terakhir dari pengguna berarti antrean staf yang menunggu, bukan
    // sebaliknya. Ini yang menentukan urutan kerja, bukan status yang mungkin
    // lupa diperbarui.
    waitingOnStaff: row.messages[0]?.author.role === "USER",
  }));
}

export async function requireTicketForInternal(ticketId: string): Promise<TicketDetail> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      _count: { select: { messages: true } },
      requester: { select: { name: true, email: true, emailIsPlaceholder: true } },
      assignee: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, role: true } } },
      },
    },
  });
  if (!ticket) throw new ThreadsIntegrationError("TICKET_NOT_FOUND", "Tiket tidak ditemukan.", 404);

  return {
    ...toSummary(ticket, ticket.messages.at(-1)?.createdAt),
    requesterName: ticket.requester.name,
    requesterEmail: ticket.requester.emailIsPlaceholder ? null : ticket.requester.email,
    assigneeName: ticket.assignee?.name ?? null,
    messages: ticket.messages.map(toMessage),
  };
}

/**
 * Balasan dari staf, sekalian memperbarui status dan prioritas.
 *
 * Pengguna selalu diberi notifikasi untuk balasan yang terlihat olehnya; itu
 * satu-satunya cara dia tahu tiketnya sudah dijawab tanpa membuka dashboard
 * setiap hari. Catatan internal tidak memicu notifikasi apa pun.
 */
export async function replyAsStaff(actor: User, input: StaffReplyInput): Promise<TicketDetail> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, requesterId: true, status: true, assigneeId: true, subject: true },
  });
  if (!ticket) throw new ThreadsIntegrationError("TICKET_NOT_FOUND", "Tiket tidak ditemukan.", 404);

  const isInternal = input.isInternal === true;
  const nextStatus = (input.status as TicketStatus | undefined)
    ?? (isInternal ? ticket.status : TicketStatus.WAITING_USER);

  await prisma.$transaction(async transaction => {
    await transaction.supportMessage.create({
      data: { ticketId: ticket.id, authorId: actor.id, body: input.body, isInternal },
    });
    await transaction.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        ...(input.priority ? { priority: input.priority as TicketPriority } : {}),
        // Menjawab tiket berarti menanganinya: penugasan diisi sendiri bila
        // belum ada pemiliknya, supaya dua staf tidak menjawab hal yang sama.
        ...(input.assignToMe || !ticket.assigneeId ? { assigneeId: actor.id } : {}),
      },
    });
  });

  await recordAudit({
    actorId: actor.id,
    action: isInternal ? "SUPPORT_TICKET_NOTE_ADDED" : "SUPPORT_TICKET_REPLIED",
    entityType: "SupportTicket",
    entityId: ticket.id,
    metadata: { status: nextStatus, internal: isInternal },
  });

  if (!isInternal) {
    await createNotification({
      userId: ticket.requesterId,
      type: "SUPPORT_UPDATE",
      title: "Tiket dukungan Anda dijawab",
      body: `Tim dukungan membalas tiket "${ticket.subject}".`,
      // Tiket punya alamatnya sendiri sejak konsol dukungan dipecah per
      // halaman, jadi notifikasinya membuka jawabannya, bukan daftar tiket
      // yang masih harus dicari sendiri.
      href: `/dashboard/bantuan/${ticket.id}`,
    }).catch(() => undefined);
  }

  return requireTicketForInternal(ticket.id);
}
