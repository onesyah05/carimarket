import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { BUSINESS_CATEGORIES } from "@/features/settings/lib/business-categories";

export const runtime = "nodejs";

const inputSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  email: z.string().trim().toLowerCase().max(191).pipe(z.email({ message: "Format email tidak valid." })),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(255),
  businessName: z.string().trim().min(2, "Nama bisnis minimal 2 karakter.").max(140),
  businessCategory: z.enum(BUSINESS_CATEGORIES, { message: "Pilih kategori bisnis." }),
  businessArea: z.string().trim().max(255),
  businessDescription: z.string().trim().min(2, "Deskripsi bisnis minimal 2 karakter.").max(5000),
  consent: z.literal(true, { message: "Anda harus menyetujui Syarat dan Ketentuan." }),
});

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const ip = clientIp(request);
    enforceRateLimit(`auth-register:${ip ?? "unknown"}`, 5, 300_000);

    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Periksa kembali isian pendaftaran.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: input.data.email } });
    if (existing) {
      throw new ThreadsIntegrationError("EMAIL_TAKEN", "Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.", 409);
    }

    const passwordHash = await hashPassword(input.data.password);
    const user = await prisma.user.create({
      data: {
        email: input.data.email,
        name: input.data.name,
        passwordHash,
        role: "USER",
        status: "PENDING_VERIFICATION",
        replyAutomation: { create: {} },
        notification: { create: {} },
        businessProfile: {
          create: {
            name: input.data.businessName,
            category: input.data.businessCategory,
            serviceArea: input.data.businessArea || null,
            description: input.data.businessDescription,
            onboardingCompletedAt: new Date(),
          },
        },
      },
    });

    await createSession(user.id, { ip, userAgent: request.headers.get("user-agent") ?? undefined });
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "AUTH_REGISTER",
        entityType: "User",
        entityId: user.id,
        ipHash: ip ? createHash("sha256").update(ip).digest("hex") : null,
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, data: { role: user.role } }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
