import "server-only";
import type { ThreadsAdapter } from "./types";

export const localThreadsAdapter: ThreadsAdapter = {
  async getCapability() { return "LOCAL_DATA"; },
  async searchPosts(query) {
    return [{
      externalPostId: `local-${query.toLowerCase().replaceAll(" ", "-")}`,
      authorHandle: "@andriworks",
      authorName: "Andri Wijaya",
      body: `Ada rekomendasi ${query} untuk dokumentasi proyek di BSD?`,
      permalink: "https://www.threads.net/",
      postedAt: new Date("2026-09-29T02:30:00.000Z"),
      capability: "LOCAL_DATA",
      simulated: true,
      likeCount: 12,
      replyCount: 3,
      repostCount: 1,
    }];
  },
  async publishReply() { return { status: "SIMULATED_SENT" }; },
  async getPublishingLimit() {
    return { quotaUsage: 0, quotaLimit: 250, replyQuotaUsage: 0, replyQuotaLimit: 1000 };
  },
};
