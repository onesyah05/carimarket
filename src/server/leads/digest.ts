import "server-only";
import { prisma } from "@/lib/prisma";
import { classifyLeadIntent } from "@/lib/lead-intent";
import { createNotification } from "@/server/notifications/service";
import { isMatch, type AiVerdict } from "./ai-matching";

/**
 * Satu email berisi daftar lead, bukan satu email per kata kunci.
 *
 * Sebelumnya tiap kata kunci yang menemukan sesuatu mengirim notifikasinya
 * sendiri, jadi akun dengan lima kata kunci menerima lima email untuk satu
 * kali pencarian — dan tak satu pun menyebut lead apa yang ditemukan, hanya
 * jumlahnya. Ringkasan ini menunggu seluruh kata kunci selesai, lalu mengirim
 * satu email yang benar-benar memuat daftarnya.
 *
 * Hanya lead yang cocok dengan bisnis yang masuk. Lead yang dinilai tidak
 * cocok tetap tersimpan dan tetap terlihat di feed — yang tidak dilakukan
 * hanyalah menempatkannya di kotak masuk orang.
 */

const MAX_LEADS_IN_EMAIL = 20;

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
    },
    orderBy: { discoveredAt: "desc" },
  }).catch(() => []);

  const matched = leads.filter(lead => isMatch(
    (lead.aiVerdict ?? "UNKNOWN") as AiVerdict,
    lead.aiScore ?? Number(lead.relevanceScore),
    classifyLeadIntent(lead.threadPost.body),
  ));
  if (matched.length === 0) return { matched: 0, skipped: leads.length };

  const shown = matched.slice(0, MAX_LEADS_IN_EMAIL);
  const remainder = matched.length - shown.length;
  const title = `${matched.length} lead cocok untuk bisnis Anda`;

  const lines = shown.map(lead => {
    const handle = lead.threadPost.authorHandle ? `@${lead.threadPost.authorHandle}` : lead.threadPost.authorName ?? "Tanpa nama";
    const reason = lead.aiReason ?? lead.matchReason ?? "";
    return `• ${handle} — ${excerpt(lead.threadPost.body)}${reason ? `\n  ${reason}` : ""}`;
  });
  if (remainder > 0) lines.push(`• dan ${remainder} lead lainnya di dashboard.`);

  await createNotification({
    userId,
    type: "LEAD_DISCOVERED",
    title,
    body: [`Pencarian terakhir menemukan ${matched.length} lead yang cocok dengan profil bisnis Anda.`, "", ...lines].join("\n"),
    href: "/dashboard/leads",
    html: digestHtml(matched.length, shown, remainder),
  });

  return { matched: matched.length, skipped: leads.length - matched.length };
}

function excerpt(body: string) {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

/** Entitas HTML di-escape karena isinya teks orang lain, bukan teks kita. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type DigestLead = {
  aiReason: string | null;
  matchReason: string | null;
  threadPost: { authorHandle: string | null; authorName: string | null; body: string; permalink: string | null };
};

function digestHtml(total: number, leads: DigestLead[], remainder: number) {
  const items = leads.map(lead => {
    const handle = escapeHtml(lead.threadPost.authorHandle ? `@${lead.threadPost.authorHandle}` : lead.threadPost.authorName ?? "Tanpa nama");
    const reason = lead.aiReason ?? lead.matchReason;
    const link = lead.threadPost.permalink;
    const heading = link
      ? `<a href="${escapeHtml(link)}" style="color:#2f5fc4;text-decoration:none;font-weight:700">${handle}</a>`
      : `<strong>${handle}</strong>`;
    return `<li style="margin:0 0 14px">${heading}<div style="color:#17213a;margin-top:3px">${escapeHtml(excerpt(lead.threadPost.body))}</div>${reason ? `<div style="color:#636e88;font-size:13px;margin-top:3px">${escapeHtml(reason)}</div>` : ""}</li>`;
  }).join("");
  const more = remainder > 0 ? `<p style="color:#636e88">dan ${remainder} lead lainnya di dashboard.</p>` : "";
  return [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#17213a">',
    `<p>Pencarian terakhir menemukan <strong>${total}</strong> lead yang cocok dengan profil bisnis Anda.</p>`,
    `<ul style="padding-left:18px;margin:18px 0">${items}</ul>`,
    more,
    '<p><a href="https://carimarket.id/dashboard/leads" style="color:#2f5fc4;font-weight:700">Buka feed lead</a></p>',
    "</div>",
  ].join("");
}
