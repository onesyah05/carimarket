import { NextResponse } from "next/server";
import { listKeywordSuggestions } from "@/server/leads/keyword-suggestions";
import { listWorkspaceLeads } from "@/server/leads/queries";
import { runAllActiveKeywords } from "@/server/leads/search-service";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { isThreadsAvailable } from "@/server/integrations/threads/config";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { requireWorkspaceContext } from "@/server/workspace/context";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await isThreadsAvailable())) throw new ThreadsIntegrationError("THREADS_NOT_CONFIGURED", "Koneksi Threads belum tersedia. Silakan hubungi administrator.", 409);
    const { profile } = await requireWorkspaceContext();
    const [leads, suggestions] = await Promise.all([listWorkspaceLeads(profile.id), listKeywordSuggestions(profile.id)]);
    return NextResponse.json({ success: true, data: leads, meta: { suggestions } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/**
 * POST — menjalankan seluruh kata kunci pencarian yang aktif.
 *
 * Dulu endpoint ini menerima satu frasa bebas dan menyimpannya sebagai
 * Keyword baru. Itu membuat kotak pencarian diam-diam memakan jatah paket
 * dan menumpuk kata kunci kembar. Menyusun kata kunci kini sepenuhnya milik
 * halaman Kata kunci; di sini tinggal menjalankannya.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    if (!(await isThreadsAvailable())) throw new ThreadsIntegrationError("THREADS_NOT_CONFIGURED", "Koneksi Threads belum tersedia. Silakan hubungi administrator.", 409);

    const { user, profile } = await requireWorkspaceContext();
    enforceRateLimit(`threads-search:${user.id}`, 10, 60_000);

    const summary = await runAllActiveKeywords(profile.id);
    const [leads, suggestions] = await Promise.all([listWorkspaceLeads(profile.id), listKeywordSuggestions(profile.id)]);
    return NextResponse.json({ success: true, data: leads, meta: { ...summary, suggestions } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
