import "server-only";
import { prisma } from "@/lib/prisma";
import { classifyLeadIntent } from "@/lib/lead-intent";
import { createNotification } from "@/server/notifications/service";
import { isMatch, MATCH_THRESHOLD, type AiVerdict } from "./ai-matching";

/**
 * Satu email berisi daftar lead, bukan satu email per kata kunci.
 *
 * Sebelumnya tiap kata kunci yang menemukan sesuatu mengirim notifikasinya
 * sendiri, jadi akun dengan lima kata kunci menerima lima email untuk satu
 * kali pencarian, dan tak satu pun menyebut lead apa yang ditemukan, hanya
 * jumlahnya. Ringkasan ini menunggu seluruh kata kunci selesai, lalu mengirim
 * satu email yang benar-benar memuat daftarnya.
 *
 * Hanya lead yang lolos ambang kecocokan yang masuk. Lead di bawah ambang
 * tetap tersimpan dan tetap terlihat di feed; yang tidak dilakukan hanyalah
 * menempatkannya di kotak masuk orang.
 */

const MAX_LEADS_IN_EMAIL = 20;

/** Token warna produk, disalin sebagai literal karena email tidak memuat CSS variabel. */
const INK = "#0b1739";
const MUTED = "#61708c";
const BRAND = "#2d63cf";
const BRAND_SOFT = "#edf3ff";
const LINE = "#dce5f3";
const CANVAS = "#f4f7fc";
const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type LeadDigestResult = { matched: number; skipped: number } | null;

export async function sendLeadDigest(userId: string, leadIds: string[]): Promise<LeadDigestResult> {
  const unique = [...new Set(leadIds)];
  if (unique.length === 0) return null;

  const leads = await prisma.lead.findMany({
    where: { id: { in: unique }, userId },
    select: {
      id: true,
      relevanceScore: true,
      aiVerdict: true,
      aiScore: true,
      aiReason: true,
      matchReason: true,
      threadPost: { select: { authorHandle: true, authorName: true, body: true, permalink: true } },
      keywordMatches: { select: { keyword: { select: { phrase: true } } }, take: 1 },
    },
    orderBy: { discoveredAt: "desc" },
  }).catch(() => []);

  const scored = leads.map(lead => ({
    ...lead,
    score: lead.aiScore ?? Math.round(Number(lead.relevanceScore)),
  }));

  const matched = scored
    .filter(lead => isMatch(
      (lead.aiVerdict ?? "UNKNOWN") as AiVerdict,
      lead.score,
      classifyLeadIntent(lead.threadPost.body),
    ))
    // Yang paling meyakinkan lebih dulu. Email dibaca dari atas, dan kalau
    // hanya dua yang sempat dibuka, dua itu harus yang terbaik.
    .sort((a, b) => b.score - a.score);

  if (matched.length === 0) return { matched: 0, skipped: leads.length };

  const shown = matched.slice(0, MAX_LEADS_IN_EMAIL);
  const remainder = matched.length - shown.length;
  const title = matched.length === 1
    ? "1 lead cocok untuk bisnis Anda"
    : `${matched.length} lead cocok untuk bisnis Anda`;

  const lines = shown.map(lead => {
    const reason = lead.aiReason ?? lead.matchReason ?? "";
    return [
      `• ${handleOf(lead)} (skor ${lead.score})`,
      `  ${excerpt(lead.threadPost.body)}`,
      reason ? `  Alasan: ${reason}` : "",
      lead.threadPost.permalink ? `  ${lead.threadPost.permalink}` : "",
    ].filter(Boolean).join("\n");
  });
  if (remainder > 0) lines.push(`• dan ${remainder} lead lainnya di dashboard.`);

  await createNotification({
    userId,
    type: "LEAD_DISCOVERED",
    title,
    body: [
      `Pencarian terakhir menemukan ${matched.length} lead dengan skor ${MATCH_THRESHOLD} ke atas.`,
      "",
      ...lines,
    ].join("\n"),
    href: "/dashboard/leads",
    html: buildDigestHtml(matched.length, shown, remainder),
  });

  return { matched: matched.length, skipped: leads.length - matched.length };
}

function handleOf(lead: DigestLead) {
  if (lead.threadPost.authorHandle) return `@${lead.threadPost.authorHandle}`;
  return lead.threadPost.authorName ?? "Tanpa nama";
}

function excerpt(body: string) {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 179)}…` : flat;
}

/** Entitas HTML di-escape karena isinya teks orang lain, bukan teks kita. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tautan hanya dipasang bila benar-benar http(s), supaya `javascript:` tidak pernah jadi tautan. */
function safeHref(value: string | null) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

export type DigestLead = {
  score: number;
  aiReason: string | null;
  matchReason: string | null;
  threadPost: { authorHandle: string | null; authorName: string | null; body: string; permalink: string | null };
  keywordMatches: Array<{ keyword: { phrase: string } }>;
};

/**
 * Tata letaknya memakai tabel dan gaya inline, bukan flexbox dan kelas.
 * Outlook masih merender dengan mesin Word, dan di sana tabel adalah satu
 * satunya hal yang dapat diandalkan.
 */
export function buildDigestHtml(total: number, leads: DigestLead[], remainder: number) {
  const cards = leads.map(lead => {
    const handle = escapeHtml(handleOf(lead));
    const reason = lead.aiReason ?? lead.matchReason;
    const phrase = lead.keywordMatches[0]?.keyword.phrase;
    const href = safeHref(lead.threadPost.permalink);

    return `
      <tr><td style="padding:0 0 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:12px;background:#ffffff">
          <tr><td style="padding:16px 18px">

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font:700 15px ${FONT};color:${INK}">${handle}</td>
                <td align="right" style="white-space:nowrap">
                  <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${BRAND_SOFT};color:${BRAND};font:700 12px ${FONT}">Skor ${lead.score}</span>
                </td>
              </tr>
            </table>

            ${phrase ? `<div style="margin:8px 0 0;font:400 12px ${FONT};color:${MUTED}">Ditemukan lewat kata kunci: ${escapeHtml(phrase)}</div>` : ""}

            <div style="margin:10px 0 0;font:400 14px/1.6 ${FONT};color:${INK}">${escapeHtml(excerpt(lead.threadPost.body))}</div>

            ${reason ? `<div style="margin:10px 0 0;padding:9px 12px;border-radius:9px;background:${CANVAS};font:400 13px/1.55 ${FONT};color:${MUTED}">${escapeHtml(reason)}</div>` : ""}

            ${href ? `<div style="margin:12px 0 0"><a href="${escapeHtml(href)}" style="font:700 13px ${FONT};color:${BRAND};text-decoration:none">Buka postingan di Threads &rarr;</a></div>` : ""}

          </td></tr>
        </table>
      </td></tr>`;
  }).join("");

  const more = remainder > 0
    ? `<tr><td style="padding:2px 0 14px;font:400 13px ${FONT};color:${MUTED}">dan ${remainder} lead lainnya menunggu di dashboard.</td></tr>`
    : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">

      <tr><td style="padding:0 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:14px;background:${BRAND}">
          <tr><td style="padding:22px 24px">
            <div style="font:700 13px ${FONT};color:#c9dcff">Cari Market</div>
            <div style="margin:6px 0 0;font:700 22px/1.3 ${FONT};color:#ffffff">${total} lead cocok untuk bisnis Anda</div>
            <div style="margin:8px 0 0;font:400 14px/1.6 ${FONT};color:#dce9ff">Semuanya berskor ${MATCH_THRESHOLD} ke atas. Lead di bawah itu tetap tersimpan di feed, hanya tidak dikirim lewat email.</div>
          </td></tr>
        </table>
      </td></tr>

      ${cards}
      ${more}

      <tr><td style="padding:6px 0 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-radius:10px;background:${BRAND}">
            <a href="https://carimarket.id/dashboard/leads" style="display:inline-block;padding:12px 22px;font:700 14px ${FONT};color:#ffffff;text-decoration:none">Buka feed lead</a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:22px 0 0;border-top:1px solid ${LINE};margin-top:18px">
        <div style="font:400 12px/1.6 ${FONT};color:${MUTED}">
          Anda menerima email ini karena pencarian kata kunci Cari Market menemukan lead baru.
          Atur frekuensi dan jenis pemberitahuan di
          <a href="https://carimarket.id/dashboard/pengaturan" style="color:${BRAND};text-decoration:none">Pengaturan</a>.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>`.trim();
}
