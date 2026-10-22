import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

/**
 * Batas baris per bagian.
 *
 * Dulu ekspor mengambil seluruh lead dan draft lalu menyusunnya di memori.
 * Akun yang sudah lama berjalan dapat memiliki puluhan ribu baris, dan satu
 * permintaan seperti itu cukup untuk menghabiskan memori proses — artinya satu
 * pengguna dapat menjatuhkan aplikasi untuk semua orang.
 *
 * Potongannya diambil dari yang terbaru dan jumlah totalnya ikut dilaporkan,
 * sehingga berkasnya jujur tentang apa yang tidak termuat.
 */
const SECTION_LIMIT = 2_000;

export async function GET() {
  try {
    const user = await getSettingsUser();
    enforceRateLimit(`data-export:${user.id}`, 3, 3_600_000);

    const [profile, leadTotal, draftTotal] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          email: true,
          name: true,
          createdAt: true,
          businessProfiles: { select: { name: true, category: true, description: true, location: true, serviceArea: true, brandVoice: true } },
          notification: { select: { emailLead: true, emailReply: true, emailQuota: true } },
          replyAutomation: { select: { mode: true, minimumScore: true, dailyLimit: true, delayMinutes: true, pauseOnRisk: true, quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true } },
          keywords: { select: { phrase: true, kind: true, isActive: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: SECTION_LIMIT },
          leads: { select: { status: true, relevanceScore: true, matchReason: true, discoveredAt: true, threadPost: { select: { authorHandle: true, body: true, permalink: true, postedAt: true } } }, orderBy: { discoveredAt: "desc" }, take: SECTION_LIMIT },
          replyDrafts: { select: { body: true, status: true, deliveryMode: true, scheduledFor: true, sentAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: SECTION_LIMIT },
          subscriptions: { select: { status: true, currentPeriodStart: true, currentPeriodEnd: true, plan: { select: { name: true, code: true } } }, orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.lead.count({ where: { userId: user.id } }),
      prisma.replyDraft.count({ where: { userId: user.id } }),
    ]);

    const body = JSON.stringify({
      exportedAt: new Date().toISOString(),
      // Bagian yang terpotong disebut apa adanya, bukan dibiarkan tampak utuh.
      cakupan: {
        batasPerBagian: SECTION_LIMIT,
        lead: { disertakan: profile.leads.length, total: leadTotal },
        draftBalasan: { disertakan: profile.replyDrafts.length, total: draftTotal },
        catatan: leadTotal > SECTION_LIMIT || draftTotal > SECTION_LIMIT
          ? `Hanya ${SECTION_LIMIT} baris terbaru per bagian yang disertakan. Hubungi dukungan untuk salinan lengkap.`
          : "Seluruh data Anda termuat dalam berkas ini.",
      },
      data: profile,
    }, null, 2);

    const filename = `cari-market-data-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
