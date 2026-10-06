import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  company: z.string().trim().max(140).optional(),
  message: z.string().trim().min(10).max(4000),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Data kontak tidak valid." }, { status: 400 });
  return NextResponse.json({ ok: false, message: "Pesan belum dapat dikirim saat ini. Silakan coba lagi nanti." }, { status: 503 });
}
