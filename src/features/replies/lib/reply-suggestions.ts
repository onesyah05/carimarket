export type ReplyTone = "Ramah & profesional" | "Singkat" | "Informatif";

export function replySuggestions(input: {
  author: string;
  keyword: string;
  businessName: string;
  category: string;
  serviceArea?: string | null;
}): Record<ReplyTone, string> {
  const name = input.author.trim().split(/\s+/)[0]?.replace(/^@/, "") || "Kak";
  const topic = input.keyword === "Threads" ? "kebutuhan yang Anda ceritakan" : `kebutuhan ${input.keyword}`;
  const business = input.businessName.trim();
  const service = input.category.trim();
  const area = input.serviceArea?.trim() ? ` di ${input.serviceArea.trim()}` : "";
  return {
    "Ramah & profesional": `Halo Kak ${name}, saya dari ${business}. Saya melihat postingan Anda tentang ${topic}. Kami bergerak di bidang ${service}${area}. Jika masih relevan, boleh saya tahu detail kebutuhan Anda agar kami dapat memberi informasi yang tepat?`,
    Singkat: `Halo Kak ${name}, saya dari ${business}. Apakah ${topic} masih dibutuhkan? Kami bergerak di bidang ${service}${area} dan siap menjelaskan layanan kami jika berkenan.`,
    Informatif: `Halo Kak ${name}, saya melihat postingan Anda tentang ${topic}. ${business} menyediakan layanan di bidang ${service}${area}. Agar respons kami sesuai, boleh ceritakan cakupan kebutuhan dan waktu yang Anda harapkan?`,
  };
}
