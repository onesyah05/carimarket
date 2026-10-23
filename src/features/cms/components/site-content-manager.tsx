"use client";

import { RichTextEditor } from "@/components/rich-text-editor";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ManagedFaq } from "@/server/cms/faq";
import type { StaticPageContent } from "@/server/cms/static-pages";

/**
 * Pengelolaan konten halaman publik: FAQ dan teks halaman statis.
 *
 * Keduanya digabung dalam satu halaman karena selalu disunting bersama ketika
 * ada perubahan produk — mengubah batasan Meta berarti mengubah jawaban FAQ
 * dan paragraf di halaman Tentang pada kesempatan yang sama.
 *
 * Status sumber ditampilkan terang-terangan: operator perlu tahu apakah yang
 * dilihat pengunjung berasal dari database atau masih salinan bawaan di kode,
 * karena menyunting salinan bawaan berarti membuat baris baru, bukan mengubah.
 */

const CATEGORY_LABEL: Record<ManagedFaq["category"], string> = {
  UMUM: "Cara kerja & umum",
  FITUR: "Mode balasan & fitur",
  KEAMANAN: "Keamanan & Meta",
  HARGA: "Paket & harga",
};

const PAGE_LABEL: Record<string, string> = {
  tentang: "Halaman Tentang Kami",
  "harga-catatan": "Catatan di halaman Harga",
};

type Draft = {
  id: string | null;
  question: string;
  answer: string;
  category: ManagedFaq["category"];
  position: number;
  isActive: boolean;
};

const EMPTY_DRAFT: Draft = { id: null, question: "", answer: "", category: "UMUM", position: 0, isActive: true };

export function SiteContentManager({ faqs, pages }: { faqs: ManagedFaq[]; pages: StaticPageContent[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function call(url: string, method: string, payload?: unknown) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(url, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Perubahan belum tersimpan. Silakan coba lagi.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function saveFaq(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const payload = {
      question: draft.question,
      answer: draft.answer,
      category: draft.category,
      position: draft.position,
      isActive: draft.isActive,
    };
    const ok = draft.id
      ? await call("/api/cms/faq", "PUT", { ...payload, id: draft.id })
      : await call("/api/cms/faq", "POST", payload);
    if (ok) {
      setDraft(null);
      setNotice("Pertanyaan tersimpan dan langsung berlaku di halaman publik.");
    }
  }

  async function savePage(event: React.FormEvent<HTMLFormElement>, slug: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await call("/api/cms/halaman", "PUT", {
      slug,
      title: form.get("title"),
      intro: String(form.get("intro") ?? "").trim() || undefined,
      body: form.get("body"),
    });
    if (ok) setNotice(`${PAGE_LABEL[slug] ?? slug} tersimpan.`);
  }

  return (
    <div className="cms-content-manager">
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-feedback form-feedback--success" role="status">{notice}</p>}

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Pertanyaan umum</h2>
            <p>
              Tampil di beranda dan halaman harga, sekaligus menjadi structured data FAQPage untuk mesin pencari.
              {faqs.length === 0 && " Tabel masih kosong, jadi halaman publik memakai salinan bawaan di kode."}
            </p>
          </div>
          <div className="cms-head-actions">
            {faqs.length === 0 && (
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void call("/api/cms/faq", "POST", { action: "seed" })}
                disabled={pending}
              >
                Isi dari salinan bawaan
              </button>
            )}
            <button className="button button--primary" type="button" onClick={() => setDraft(EMPTY_DRAFT)} disabled={pending}>
              <Plus size={16} /> Pertanyaan baru
            </button>
          </div>
        </header>

        {faqs.length > 0 && (
          <ul className="cms-faq-list">
            {faqs.map(faq => (
              <li key={faq.id} className={faq.isActive ? "" : "is-hidden"}>
                <div className="cms-faq-main">
                  <strong>{faq.question}</strong>
                  <p>{faq.answer}</p>
                  <span className="cms-faq-meta">
                    {CATEGORY_LABEL[faq.category]} · urutan {faq.position}
                    {faq.isActive ? "" : " · disembunyikan"} · diperbarui {formatDateTime(faq.updatedAt)}
                  </span>
                </div>
                <div className="cms-faq-actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => setDraft({ ...faq, id: faq.id })}
                    disabled={pending}
                  >
                    Sunting
                  </button>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => void call(`/api/cms/faq?id=${encodeURIComponent(faq.id)}`, "DELETE")}
                    disabled={pending}
                  >
                    <Trash2 size={15} /> Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {draft && (
          <form className="form-grid cms-faq-form" onSubmit={saveFaq}>
            <div className="field">
              <label htmlFor="faq-question">Pertanyaan</label>
              <input
                className="input"
                id="faq-question"
                value={draft.question}
                onChange={event => setDraft({ ...draft, question: event.target.value })}
                minLength={10}
                maxLength={255}
                required
                disabled={pending}
              />
            </div>
            <div className="field">
              <label htmlFor="faq-answer">Jawaban</label>
              <RichTextEditor
                id="faq-answer"
                rows={5}
                value={draft.answer}
                onChange={answer => setDraft({ ...draft, answer })}
                maxLength={4000}
                disabled={pending}
              />
            </div>
            <div className="form-row">
              <label className="field">
                <span>Kategori</span>
                <select
                  className="input"
                  value={draft.category}
                  onChange={event => setDraft({ ...draft, category: event.target.value as ManagedFaq["category"] })}
                  disabled={pending}
                >
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Urutan</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={999}
                  value={draft.position}
                  onChange={event => setDraft({ ...draft, position: Number(event.target.value) })}
                  disabled={pending}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={event => setDraft({ ...draft, isActive: event.target.checked })}
                  disabled={pending}
                /> Tampilkan di halaman publik
              </label>
            </div>
            <div className="form-row">
              <button className="button button--primary" type="submit" disabled={pending}>
                <Save size={16} /> {pending ? "Menyimpan…" : "Simpan pertanyaan"}
              </button>
              <button className="button button--ghost" type="button" onClick={() => setDraft(null)} disabled={pending}>
                Batal
              </button>
            </div>
          </form>
        )}
      </section>

      {pages.map(page => (
        <section className="panel" key={page.slug}>
          <header className="panel-head">
            <div>
              <h2>{PAGE_LABEL[page.slug] ?? page.slug}</h2>
              <p>
                {page.source === "database"
                  ? `Disunting terakhir ${formatDateTime(page.updatedAt)}${page.updatedByName ? ` oleh ${page.updatedByName}` : ""}.`
                  : "Masih memakai salinan bawaan di kode. Menyimpan akan membuat baris baru yang menimpanya."}
              </p>
            </div>
            {page.source === "database" && (
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void call(`/api/cms/halaman?slug=${encodeURIComponent(page.slug)}`, "DELETE")}
                disabled={pending}
              >
                <RotateCcw size={15} /> Kembalikan ke bawaan
              </button>
            )}
          </header>

          <form className="form-grid" onSubmit={event => void savePage(event, page.slug)}>
            <div className="field">
              <label htmlFor={`title-${page.slug}`}>Judul</label>
              <input className="input" id={`title-${page.slug}`} name="title" defaultValue={page.title} minLength={3} maxLength={191} required disabled={pending} />
            </div>
            <div className="field">
              <label htmlFor={`intro-${page.slug}`}>Pembuka (opsional)</label>
              <RichTextEditor id={`intro-${page.slug}`} name="intro" rows={2} maxLength={1000} defaultValue={page.intro ?? ""} disabled={pending} />
            </div>
            <div className="field">
              <label htmlFor={`body-${page.slug}`}>Isi</label>
              <RichTextEditor id={`body-${page.slug}`} name="body" rows={10} maxLength={20000} defaultValue={page.body} disabled={pending} />
              <span className="field-hint">
                Pisahkan paragraf dengan satu baris kosong. Awali baris dengan <code>## </code> untuk membuat subjudul.
                HTML tidak diproses, jadi teks di sini tidak pernah menjadi skrip di halaman publik.
              </span>
            </div>
            <button className="button button--primary" type="submit" disabled={pending}>
              <Save size={16} /> {pending ? "Menyimpan…" : "Simpan halaman"}
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
