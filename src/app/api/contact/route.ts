import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { isEmailConfigured } from "@/server/integrations/email/mailer";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().max(191).pipe(z.email()),
  company: z.string().trim().max(140).optional(),
  message: z.string().trim().min(10).max(4000),
});

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit(`contact:${clientIp(request)}`, 5, 600_000);

    const parsed = contactSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Data kontak tidak valid." }, { status: 400 });
    }

    await prisma.contactSubmission.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company?.trim() || null,
        message: parsed.data.message,
      },
    });

    // Notifikasi email ke tim belum aktif; pesan tetap tersimpan dan muncul di
    // panel dukungan, jadi tidak ada data yang hilang.
    return NextResponse.json({
      ok: true,
      message: isEmailConfigured()
        ? "Pesan Anda terkirim. Tim kami akan menghubungi Anda melalui email."
        : "Pesan Anda tersimpan dan akan ditinjau tim dukungan.",
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json({ ok: false, error: result.body.error }, { status: result.status });
  }
}
