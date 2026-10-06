"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ArticleEditor, type ArticleFieldsInput } from "./article-editor";
import { formatDateTime } from "@/lib/format";

export type CmsArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  categoryName: string | null;
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  status: "DRAFT" | "IN_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  author: string;
  authorId: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

const STATUS_ORDER = ["DRAFT", "IN_REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

const FILTERS: Array<{ key: "ALL" | CmsArticle["status"]; label: string }> = [
  { key: "ALL", label: "Semua" },
  { key: "DRAFT", label: "Draft" },
  { key: "IN_REVIEW", label: "Dalam review" },
  { key: "SCHEDULED", label: "Terjadwal" },
  { key: "PUBLISHED", label: "Terbit" },
  { key: "ARCHIVED", label: "Arsip" },
];

function Chip({ status }: { status: CmsArticle["status"] }) {
  const labels: Record<CmsArticle["status"], string> = { DRAFT: "Draft", IN_REVIEW: "Dalam review", SCHEDULED: "Terjadwal", PUBLISHED: "Terbit", ARCHIVED: "Arsip" };
  return <span className={`chip chip--${status.toLowerCase()}`}>{labels[status]}</span>;
}

export function ArticlesManager({ role, userId, articles }: { role: "ADMIN" | "SUPERADMIN"; userId: string; articles: CmsArticle[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");
  const [editor, setEditor] = useState<{ id?: string; initial: ArticleFieldsInput } | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>([["ALL", articles.length]]);
    for (const status of STATUS_ORDER) map.set(status, articles.filter(article => article.status === status).length);
    return map;
  }, [articles]);

  const visible = filter === "ALL" ? articles : articles.filter(article => article.status === filter);

  async function call(id: string, body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    try {
      const response = await fetch(`/api/cms/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Aksi belum berhasil.");
        return;
      }
      setSchedulingId(null);
      setScheduleAt("");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(article: CmsArticle) {
    setBusy(`del-${article.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/cms/articles/${article.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Artikel belum terhapus.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  function openEditor(article: CmsArticle) {
    setEditor({
      id: article.id,
      initial: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt ?? "",
        content: article.content,
        coverImageUrl: article.coverImageUrl ?? "",
        categoryName: article.categoryName ?? "",
        tags: article.tags.join(", "),
        metaTitle: article.metaTitle ?? "",
        metaDescription: article.metaDescription ?? "",
      },
    });
  }

  return (
    <>
      <div className="cms-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filter status artikel">
          {FILTERS.map(item => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? "active" : ""}
              onClick={() => setFilter(item.key)}
              aria-pressed={filter === item.key}
            >
              {item.label} <small>{counts.get(item.key) ?? 0}</small>
            </button>
          ))}
        </div>
        <button className="button button--primary button--small" type="button" onClick={() => setEditor({ initial: { title: "", slug: "", excerpt: "", content: "", coverImageUrl: "", categoryName: "", tags: "", metaTitle: "", metaDescription: "" } })}>
          <Plus size={15} /> Artikel baru
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="panel table-panel">
        <div className="panel-heading internal-panel-heading"><div><h2>Daftar artikel</h2><p>Kelola status dan jadwal publikasi konten.</p></div><span className="internal-count">{visible.length.toLocaleString("id-ID")} ditampilkan</span></div>
        <div className="data-table internal-table">
          {visible.length === 0 && (
            <div className="table-empty">
              <strong>Belum ada artikel pada tampilan ini.</strong>
              <p>Buat artikel baru untuk mulai mengisi blog.</p>
            </div>
          )}
          {visible.map(article => {
            const isSuper = role === "SUPERADMIN";
            const ownDraft = article.authorId === userId && article.status === "DRAFT";
            const schedule = article.publishedAt ? `Terbit ${formatDateTime(article.publishedAt)}` : article.scheduledFor ? `Terjadwal ${formatDateTime(article.scheduledFor)}` : "Belum terjadwalkan";
            return (
              <div className="data-row stack-row" key={article.id}>
                <div className="stack-row__top">
                  <strong>{article.title}</strong>
                  <Chip status={article.status} />
                  {isSuper || ownDraft ? (
                    <button className="button button--small button--ghost" type="button" onClick={() => openEditor(article)}>Edit</button>
                  ) : null}
                </div>
                <div className="stack-row__meta">
                  <span>{article.author}</span>
                  <span>{article.categoryName ?? "Tanpa kategori"}</span>
                  <span>/blog/{article.slug}</span>
                  <span>{schedule}</span>
                </div>
                <div className="stack-row__actions">
                  {article.status === "DRAFT" && (isSuper || ownDraft) && (
                    <button className="button button--small button--ghost" type="button" disabled={busy !== null} onClick={() => void call(article.id, { action: "SUBMIT_REVIEW" }, `sub-${article.id}`)}>
                      {busy === `sub-${article.id}` ? "…" : "Ajukan review"}
                    </button>
                  )}
                  {isSuper && (article.status === "DRAFT" || article.status === "IN_REVIEW") && (
                    <button className="button button--small button--primary" type="button" disabled={busy !== null} onClick={() => void call(article.id, { action: "PUBLISH" }, `pub-${article.id}`)}>
                      {busy === `pub-${article.id}` ? "…" : "Terbitkan"}
                    </button>
                  )}
                  {isSuper && (article.status === "DRAFT" || article.status === "IN_REVIEW") && (
                    <button className="button button--small button--ghost" type="button" onClick={() => { setSchedulingId(schedulingId === article.id ? null : article.id); setScheduleAt(""); }}>
                      Jadwalkan
                    </button>
                  )}
                  {isSuper && (article.status === "IN_REVIEW" || article.status === "SCHEDULED") && (
                    <button className="button button--small button--ghost" type="button" disabled={busy !== null} onClick={() => void call(article.id, { action: "BACK_TO_DRAFT" }, `back-${article.id}`)}>
                      {busy === `back-${article.id}` ? "…" : "Kembali ke draft"}
                    </button>
                  )}
                  {isSuper && article.status === "PUBLISHED" && (
                    <button className="button button--small button--ghost" type="button" disabled={busy !== null} onClick={() => void call(article.id, { action: "ARCHIVE" }, `arc-${article.id}`)}>
                      {busy === `arc-${article.id}` ? "…" : "Arsipkan"}
                    </button>
                  )}
                  {isSuper && article.status === "ARCHIVED" && (
                    <button className="button button--small button--ghost" type="button" disabled={busy !== null} onClick={() => void call(article.id, { action: "RESTORE" }, `res-${article.id}`)}>
                      {busy === `res-${article.id}` ? "…" : "Pulihkan"}
                    </button>
                  )}
                  {(isSuper || ownDraft) && (
                    <button className="button button--small button--danger" type="button" disabled={busy !== null} onClick={() => { if (window.confirm(`Hapus artikel "${article.title}"?`)) void remove(article); }}>
                      {busy === `del-${article.id}` ? "…" : "Hapus"}
                    </button>
                  )}
                  {!isSuper && article.status === "IN_REVIEW" && <small>Menunggu keputusan Superadmin</small>}
                  {schedulingId === article.id && (
                    <span className="schedule-box">
                      <input
                        className="input"
                        type="datetime-local"
                        value={scheduleAt}
                        onChange={event => setScheduleAt(event.currentTarget.value)}
                        aria-label="Waktu terbit"
                      />
                      <button
                        className="button button--small button--primary"
                        type="button"
                        disabled={!scheduleAt || busy !== null}
                        onClick={() => void call(article.id, { action: "SCHEDULE", scheduledFor: new Date(scheduleAt).toISOString() }, `sch-${article.id}`)}
                      >
                        {busy === `sch-${article.id}` ? "…" : "Atur jadwal"}
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {role === "ADMIN" && articles.some(article => article.status === "IN_REVIEW") && (
        <p className="panel-note">Artikel dalam review menunggu keputusan Superadmin sebelum dapat terbit.</p>
      )}

      {editor && <ArticleEditor article={editor} onClose={() => { setEditor(null); router.refresh(); }} />}
    </>
  );
}
