"use client";

import { useState } from "react";
import { ExternalLink, Heart, LoaderCircle, MessageCircle, Repeat2, Search } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { DirectSearchHit } from "@/server/leads/direct-search";

type Meta = { capability: string; query: string };

const CAPABILITY_NOTE: Record<string, string> = {
  SELF_ONLY: "Meta belum menyetujui pencarian publik, jadi Threads hanya mengembalikan postingan akun yang terhubung.",
  LOCAL_DATA: "Tidak ada koneksi Threads aktif. Hasil di bawah berasal dari data contoh untuk pengembangan.",
};

/**
 * Pencarian Threads ad hoc untuk Superadmin.
 *
 * Pencarian pelanggan menyimpan setiap kata kunci sebagai Keyword dan karena
 * itu dibatasi paket. Di sini tidak ada yang disimpan — tidak ada Keyword,
 * Lead, maupun pemakaian kuota — sehingga kata kunci bebas dicoba sebanyak
 * yang diperlukan untuk memeriksa apa yang sebenarnya dikembalikan Threads.
 */
export function LeadSearchConsole() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DirectSearchHit[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/lead-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: term }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Pencarian belum dapat dijalankan.");
        setHits([]);
        setMeta(null);
        return;
      }
      setHits(payload?.data ?? []);
      setMeta(payload?.meta ?? null);
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  const note = meta ? CAPABILITY_NOTE[meta.capability] : undefined;

  return (
    <>
      <form className="lead-scan__bar" onSubmit={search}>
        <label className="filter-search">
          <Search size={17} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Kata kunci apa pun, mis. cari jasa pembuatan website"
            aria-label="Kata kunci pencarian Threads"
            maxLength={100}
          />
        </label>
        <button className="button button--primary" type="submit" disabled={loading || query.trim().length < 2}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Cari di Threads
        </button>
      </form>

      {error && <div className="inline-error" role="alert"><strong>Pencarian belum dapat dijalankan.</strong><span>{error}</span></div>}
      {note && <p className="panel-note" role="status">{note}</p>}

      {meta && !error && (
        <div className="result-summary">
          <span><strong>{hits.length}</strong> postingan untuk “{meta.query}”</span>
          <span className="lead-scan__hint">Tidak tersimpan sebagai lead dan tidak memakai kuota.</span>
        </div>
      )}

      <div className="lead-scan__list">
        {hits.map(hit => (
          <article className="panel lead-scan__item" key={hit.externalPostId}>
            <header>
              <div>
                <strong>{hit.authorName}</strong>
                <span>{hit.authorHandle} · {formatDateTime(hit.postedAt)}</span>
              </div>
              <a className="button button--ghost button--small" href={hit.permalink} target="_blank" rel="noreferrer noopener">
                <ExternalLink size={14} /> Buka
              </a>
            </header>
            <p>{hit.body}</p>
            <footer>
              {hit.likeCount === null && hit.replyCount === null && hit.repostCount === null
                ? <span title="Threads tidak mengirim metrik untuk postingan ini">Metrik tidak tersedia</span>
                : <>
                  <span><Heart size={14} /> {hit.likeCount ?? "—"}</span>
                  <span><MessageCircle size={14} /> {hit.replyCount ?? "—"}</span>
                  <span><Repeat2 size={14} /> {hit.repostCount ?? "—"}</span>
                </>}
            </footer>
          </article>
        ))}

        {!loading && hits.length === 0 && (
          <div className="empty-state">
            <Search />
            <h2>{meta ? "Threads tidak mengembalikan postingan" : "Belum ada pencarian"}</h2>
            <p>{meta
              ? `Kata kunci “${meta.query}” tidak menghasilkan apa pun. Coba kata yang lebih umum atau periksa kredensial Threads di Integrasi.`
              : "Ketik kata kunci apa pun untuk melihat percakapan Threads terbaru. Konsol ini tidak terikat paket mana pun."}</p>
          </div>
        )}
      </div>
    </>
  );
}
