import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama bisnis minimal 2 karakter.").max(140),
  category: z.string().trim().min(2, "Kategori minimal 2 karakter.").max(100),
  serviceArea: z.string().trim().min(2, "Area layanan minimal 2 karakter.").max(255),
  description: z.string().trim().min(2, "Deskripsi minimal 2 karakter.").max(5000),
});

function serialize(profile: { name: string; category: string; serviceArea: string | null; description: string } | null) {
  return {
    name: profile?.name ?? "",
    category: profile?.category ?? "",
    serviceArea: profile?.serviceArea ?? "",
    description: profile?.description ?? "",
  };
}

export async function GET() {
  try {
    const user = await getSettingsUser();
    const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ success: true, exists: Boolean(profile), data: serialize(profile) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = profileSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? "Profil bisnis tidak valid." }, { status: 400 });
    const user = await getSettingsUser();
    const data = input.data;
    const profile = await prisma.businessProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return NextResponse.json({ success: true, exists: true, data: serialize(profile) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
