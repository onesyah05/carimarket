import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Memuat istilah terlarang aktif (sudah dinormalisasi) untuk workspace.
 * Dipakai oleh UI dan worker agar penilaian risiko draft konsisten.
 */
export async function loadBlacklistTerms(): Promise<string[]> {
  const terms = await prisma.blacklistTerm.findMany({ where: { isActive: true }, select: { normalized: true } });
  return terms.map(term => term.normalized);
}

/**
 * Benar-benar menandai teks sebagai berisiko bila memuat istilah terlarang.
 */
export function isRiskyText(text: string, terms: string[]): boolean {
  const haystack = text.toLowerCase();
  return terms.some(term => haystack.includes(term));
}
