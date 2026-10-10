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
  status: "Baru" | "Tersimpan" | "Dibalas";
  flagged?: boolean;
};
