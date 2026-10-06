import "server-only";

export type Actor = { id: string; role: "SUPERADMIN" | "ADMIN" | "USER"; status: "ACTIVE" | "SUSPENDED" };

export function requireActiveActor(actor: Actor | null): Actor {
  if (!actor) throw new Error("UNAUTHENTICATED");
  if (actor.status !== "ACTIVE") throw new Error("ACCOUNT_INACTIVE");
  return actor;
}

export function requireRole(actor: Actor, ...roles: Actor["role"][]) {
  if (!roles.includes(actor.role)) throw new Error("FORBIDDEN");
}

export function requireOwner(actor: Actor, resourceUserId: string) {
  if (actor.role !== "SUPERADMIN" && actor.id !== resourceUserId) throw new Error("FORBIDDEN");
}
