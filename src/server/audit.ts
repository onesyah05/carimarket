import "server-only";
import { prisma } from "@/lib/prisma";

export function recordAudit(input: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action.slice(0, 120),
      entityType: input.entityType.slice(0, 100),
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
    },
  }).catch(() => undefined);
}
