import "server-only";
import { prisma } from "@/lib/prisma";

export async function getLeadReplyContext(userId: string, leadId: string) {
  const [profile, draft, connection] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { userId }, select: { name: true, category: true, serviceArea: true } }),
    prisma.replyDraft.findFirst({
      where: { userId, leadId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, body: true, status: true },
    }),
    prisma.threadsConnection.findFirst({ where: { userId, status: "CONNECTED" }, select: { id: true } }),
  ]);
  return { profile, draft, connected: Boolean(connection) };
}
