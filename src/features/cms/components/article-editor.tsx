"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type ArticleFieldsInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  categoryName: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
};

function slugifyPreview(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110);
}

export function ArticleEditor({
  article,
  onClose,
}: {
  article: { id?: string; initial: ArticleFieldsInput };
  onClose: () => void;
}) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(article.id));

  useEffect(() => {
    firstFieldRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim() || undefined,
      excerpt: String(form.get("excerpt") ?? "").trim() || undefined,
      content: String(form.get("content") ?? ""),
      coverImageUrl: String(form.get("coverImageUrl") ?? "").trim() || undefined,
      categoryName: String(form.get("categoryName") ?? "").trim() || undefined,
      tags: String(form.get("tags") ?? "").split(",").map(tag => tag.trim()).filter(Boolean),
      metaTitle: String(form.get("metaTitle") ?? "").trim() || undefined,
      metaDescription: String(form.get("metaDescription") ?? "").trim() || undefined,
    };
    setPending(true);
    setError(null);
    try {
      const response = await fetch(article.id ? `/api/cms/articles/${article.id}` : "/api/cms/articles", {
        method: article.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(article.id ? { fields: payload } : payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Artikel belum tersimpan. Periksa kembali isian.");
        return;
      }
      onClose();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={article.id ? "Edit artikel" : "Artikel baru"}>
        <div className="modal-head">
          <h2>{article.id ? "Edit artikel" : "Artikel baru"}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup editor"><X size={19} /></button>
        </div>
        <form className="editor-grid" onSubmit={onSubmit}>
          <div className="editor-main">
            <div className="field">
              <label htmlFor="article-title">Judul</label>
              <input
                ref={firstFieldRef}
                className="input"
                id="article-title"
                name="title"
                defaultValue={article.initial.title}
                required
                minLength={4}
                maxLength={191}
                onChange={event => {
                  if (!slugTouched) {
                    const slugInput = document.getElementById("article-slug") as HTMLInputElement | null;
                    if (slugInput) slugInput.value = slugifyPreview(event.currentTarget.value);
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="article-slug">Slug URL</label>
              <input className="input" id="article-slug" name="slug" defaultValue={article.initial.slug} placeholder="otomatis dari judul" maxLength={191} onChange={() => setSlugTouched(true)} />
            </div>
            <div className="field">
              <label htmlFor="article-excerpt">Ringkasan</label>
              <input className="input" id="article-excerpt" name="excerpt" defaultValue={article.initial.excerpt} placeholder="Satu dua kalimat untuk kartu blog" maxLength={500} />
            </div>
            <div className="field">
              <label htmlFor="article-content">Konten</label>
              <textarea className="input" id="article-content" name="content" defaultValue={article.initial.content} required minLength={40} rows={14} />
              <small>Paragraf dipisah baris kosong. Baris diawali <code>## </code> menjadi subjudul.</small>
            </div>
          </div>
          <aside className="editor-aside">
            <div className="field">
              <label htmlFor="article-category">Kategori</label>
              <input className="input" id="article-category" name="categoryName" defaultValue={article.initial.categoryName} placeholder="mis. Panduan" maxLength={100} />
            </div>
            <div className="field">
              <label htmlFor="article-tags">Tag (pisahkan koma)</label>
              <input className="input" id="article-tags" name="tags" defaultValue={article.initial.tags} placeholder="threads, lead" />
            </div>
            <div className="field">
              <label htmlFor="article-cover">URL gambar sampul</label>
              <input className="input" id="article-cover" name="coverImageUrl" defaultValue={article.initial.coverImageUrl} placeholder="https://…" />
            </div>
            <div className="field">
              <label htmlFor="article-metatitle">Meta title (SEO)</label>
              <input className="input" id="article-metatitle" name="metaTitle" defaultValue={article.initial.metaTitle} maxLength={191} />
            </div>
            <div className="field">
              <label htmlFor="article-metadesc">Meta description (SEO)</label>
              <textarea className="input" id="article-metadesc" name="metaDescription" defaultValue={article.initial.metaDescription} rows={3} maxLength={320} />
            </div>
          </aside>
          <div className="editor-foot">
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="editor-foot__actions">
              <button className="button button--ghost button--small" type="button" onClick={onClose}>Batal</button>
              <button className="button button--primary button--small" type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan sebagai draft"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
