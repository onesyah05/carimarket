import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

const preferenceSchema = z.object({
  emailLead: z.boolean(),
  emailReply: z.boolean(),
  emailQuota: z.boolean(),
});

const defaults = { emailLead: true, emailReply: true, emailQuota: true };

export async function GET() {
  try {
    const user = await getSettingsUser();
    const preference = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ success: true, data: preference ? {
      emailLead: preference.emailLead,
      emailReply: preference.emailReply,
      emailQuota: preference.emailQuota,
    } : defaults });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = preferenceSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Pilihan notifikasi tidak valid." }, { status: 400 });
    const user = await getSettingsUser();
    const preference = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: input.data,
      create: { userId: user.id, ...input.data },
    });
    return NextResponse.json({ success: true, data: {
      emailLead: preference.emailLead,
      emailReply: preference.emailReply,
      emailQuota: preference.emailQuota,
    } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
