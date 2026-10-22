import type { LeadIntent } from "@/lib/lead-intent";

export type Lead = {
  id: string;
  externalPostId?: string;
  permalink?: string;
  author: string;
  handle: string;
  avatar: string;
  time: string;
  /** Waktu posting asli (ISO, UTC) untuk pengurutan yang akurat. */
  postedAt: string;
  text: string;
  keyword: string;
  score: number;
  /** null berarti Threads tidak mengirim metrik untuk postingan ini. */
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  location: string;
  /** Postingan mencari jasa, menawarkan jasa, atau belum jelas. */
  intent: LeadIntent;
  /** Konteks percakapan di Threads. */
  isReply: boolean;
  replyToHandle: string | null;
  threadSize: number | null;
  /** Kapan pemiliknya membuka lead ini; null berarti belum dibaca. */
  viewedAt: string | null;
  /** Vonis AI atas kecocokan dengan bisnis; null berarti belum dinilai. */
  aiVerdict?: "MATCH" | "NO_MATCH" | "UNSURE" | null;
  /** Alasan singkat dari AI, bila ada. */
  aiReason?: string | null;
  /** Kesimpulan gabungan vonis AI dan ambang angka. */
  matched?: boolean;
  status: "Baru" | "Tersimpan" | "Dibalas";
  flagged?: boolean;
};
