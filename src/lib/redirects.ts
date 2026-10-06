import type { Role } from "@prisma/client";

/**
 * Halaman muka tiap role setelah login.
 * Superadmin & admin masuk ke dashboard operasional mereka, bukan workspace
 * pengguna biasa.
 */
export function homePathForRole(role: Role | undefined | null): string {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin";
    case "ADMIN":
      return "/admin";
    default:
      return "/dashboard";
  }
}

/**
 * Menentukan tujuan redirect setelah login.
 *
 * `next` hanya dihormati bila merupakan path relatif yang aman (tidak absolut,
 * tidak `//` agar tidak bisa dialihkan ke domain lain). Bila tidak ada, tiap
 * role diarahkan ke dashboard miliknya.
 */
export function resolveNextPath(next: string | null | undefined, role: Role | undefined | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return homePathForRole(role);
}
