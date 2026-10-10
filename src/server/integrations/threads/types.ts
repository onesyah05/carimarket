export type SearchCapability = "LOCAL_DATA" | "SELF_ONLY" | "PUBLIC_SEARCH";

export type ThreadSearchResult = {
  externalPostId: string;
  authorHandle: string;
  authorName: string;
  body: string;
  permalink: string;
  postedAt: Date;
  capability: SearchCapability;
  simulated: boolean;
  /**
   * Metrik keterlibatan hanya tersedia pada jalur yang benar-benar
   * mengembalikannya. `undefined` berarti belum diketahui, bukan nol, agar UI
   * tidak menampilkan angka yang menyesatkan.
   */
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
};

export type ThreadsPublishingLimit = {
  /** Kuota publish post Threads (24 jam), dari threads_publishing_limit. */
  quotaUsage: number;
  quotaLimit: number;
  /** Kuota balasan Threads (24 jam). */
  replyQuotaUsage: number;
  replyQuotaLimit: number;
};

export interface ThreadsAdapter {
  getCapability(): Promise<SearchCapability>;
  searchPosts(query: string): Promise<ThreadSearchResult[]>;
  publishReply(input: { postId: string; body: string; idempotencyKey: string }): Promise<{ status: "SENT" | "SIMULATED_SENT"; externalReplyId?: string }>;
  getPublishingLimit(): Promise<ThreadsPublishingLimit>;
}
