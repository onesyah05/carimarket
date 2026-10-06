import { ReplyMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:MM (mis. 22:00).");

const settingsSchema = z.object({
  mode: z.enum(["review", "auto"]),
  minimumScore: z.number().int().min(70).max(100),
  dailyLimit: z.number().int().min(1).max(50),
  delayMinutes: z.number().int().refine(value => [5, 15, 30, 60].includes(value)),
  pauseOnRisk: z.boolean(),
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: timeSchema.nullable().default(null),
  quietHoursEnd: timeSchema.nullable().default(null),
}).refine(
  value => !value.quietHoursEnabled || (value.quietHoursStart !== null && value.quietHoursEnd !== null),
  { message: "Jam mulai dan jam selesai wajib diisi saat quiet hours aktif.", path: ["quietHoursStart"] },
);

function serialize(settings: {
  mode: ReplyMode;
  minimumScore: number;
  dailyLimit: number;
  delayMinutes: number;
  pauseOnRisk: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}) {
  return {
    mode: settings.mode === ReplyMode.AUTO_SEND ? "auto" : "review",
    minimumScore: settings.minimumScore,
    dailyLimit: settings.dailyLimit,
    delayMinutes: settings.delayMinutes,
    pauseOnRisk: settings.pauseOnRisk,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
  };
}

export async function GET() {
  try {
    const user = await getWorkspaceUser();
    const settings = await prisma.replyAutomationSetting.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ success: true, data: settings ? serialize(settings) : null });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = settingsSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Pengaturan balasan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    const user = await getWorkspaceUser();
    const data = {
      mode: input.data.mode === "auto" ? ReplyMode.AUTO_SEND : ReplyMode.REVIEW_FIRST,
      minimumScore: input.data.minimumScore,
      dailyLimit: input.data.dailyLimit,
      delayMinutes: input.data.delayMinutes,
      pauseOnRisk: input.data.pauseOnRisk,
      quietHoursEnabled: input.data.quietHoursEnabled,
      quietHoursStart: input.data.quietHoursEnabled ? input.data.quietHoursStart : null,
      quietHoursEnd: input.data.quietHoursEnabled ? input.data.quietHoursEnd : null,
    };
    const settings = await prisma.replyAutomationSetting.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return NextResponse.json({ success: true, data: serialize(settings) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
