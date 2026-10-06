export type Lead = {
  id: string;
  externalPostId?: string;
  permalink?: string;
  author: string;
  handle: string;
  avatar: string;
  time: string;
  text: string;
  keyword: string;
  score: number;
  likes: number;
  replies: number;
  location: string;
  status: "Baru" | "Tersimpan" | "Dibalas";
  flagged?: boolean;
};
