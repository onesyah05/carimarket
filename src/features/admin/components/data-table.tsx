"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import type { TablePage, TableRow } from "@/server/admin/tables/types";

/**
 * Tabel konsol internal.
 *
 * Satu komponen untuk seluruh tabel. Pencarian dan penomoran halaman berjalan
 * di server, jadi mengetik di kotak pencarian menelusuri **seluruh** data —
 * bukan hanya baris yang kebetulan sedang tampil. Itu perbedaan yang paling
 * penting dari tabel sebelumnya, yang memuat 30–100 baris pertama lalu
 * berhenti: tabel seperti itu menjawab "tidak ditemukan" untuk data yang
 * jelas-jelas ada.
 *
 * Halaman pertama dirender di server dan diberikan lewat `initial`, sehingga
 * tabelnya sudah terisi sebelum JavaScript sempat berjalan. Permintaan
 * berikutnya baru lewat jaringan.
 */

export type Column<Row extends TableRow = TableRow> = {
  key: string;
  label: string;
  /** Isi sel. Tanpa ini, nilai `row[key]` ditampilkan apa adanya. */
  render?: (row: Row) => React.ReactNode;
  /** Lebar kolom dalam satuan grid CSS, mis. "1.4fr" atau "140px". */
  width?: string;
  /** Kolom angka dirata-kanan agar digitnya dapat dibandingkan sekilas. */
  numeric?: boolean;
  /** Disembunyikan di layar sempit; isinya tetap ada di tampilan kartu. */
  secondary?: boolean;
};

type Props<Row extends TableRow = TableRow> = {
  resource: string;
  title: string;
  description?: string;
  /** Petunjuk kolom apa saja yang ikut dicari. */
  searchHint: string;
  columns: Array<Column<Row>>;
  initial: TablePage;
  /** Tombol di kanan kepala tabel, mis. "Tambah pengguna". */
  action?: React.ReactNode;
  emptyMessage?: string;
  /**
   * Diisi DataTable dengan fungsi pemuatan ulang.
   *
   * Aksi baris mengubah data di server, dan barisnya diambil lewat API — bukan
   * dari render server — jadi `router.refresh()` saja tidak memperbaruinya.
   * Pemanggil memanggil `reloadRef.current?.()` dari penangan peristiwanya.
   * Disalurkan lewat ref, bukan penanda angka, karena memicu pemuatan dari
   * dalam effect akan menyebabkan render berantai.
   */
  reloadRef?: React.MutableRefObject<(() => void) | null>;
};

const SEARCH_DEBOUNCE_MS = 320;

export function DataTable<Row extends TableRow = TableRow>({
  resource,
  title,
  description,
  searchHint,
  columns,
  initial,
  action,
  emptyMessage = "Belum ada data.",
  reloadRef,
}: Props<Row>) {
  const [data, setData] = useState<TablePage>(initial);
  const [input, setInput] = useState(initial.q);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchId = useId();

  // Permintaan yang sudah kedaluwarsa tidak boleh menimpa hasil yang lebih
  // baru: mengetik cepat menghasilkan beberapa permintaan sekaligus, dan yang
  // pertama berangkat tidak selalu yang pertama kembali.
  const requestRef = useRef(0);

  // Keadaan terakhir disimpan di ref supaya fungsi pemuatan ulang yang
  // diserahkan ke pemanggil tidak menutup nilai yang sudah basi.
  const stateRef = useRef({ q: initial.q, page: initial.page, pageSize: initial.pageSize });

  const load = useCallback(async (q: string, page: number, pageSize: number) => {
    const token = ++requestRef.current;
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) });
      const response = await fetch(`/api/admin/tables/${resource}?${params}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (token !== requestRef.current) return;
      if (!response.ok) {
        setError(payload?.error ?? "Data tidak dapat dimuat. Coba lagi.");
        return;
      }
      const next = payload.data as TablePage;
      stateRef.current = { q: next.q, page: next.page, pageSize: next.pageSize };
      setData(next);
    } catch {
      if (token === requestRef.current) setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      if (token === requestRef.current) setPending(false);
    }
  }, [resource]);

  // Pencarian ditunda sebentar supaya tiap ketukan tidak menjadi satu kueri.
  useEffect(() => {
    if (input === data.q) return;
    const timer = setTimeout(() => { void load(input, 1, data.pageSize); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, data.q, data.pageSize, load]);

  // Menyerahkan fungsi pemuatan ulang ke pemanggil. Menulis ke ref bukan
  // perubahan state, jadi tidak ada render tambahan yang terpicu dari sini.
  useEffect(() => {
    if (!reloadRef) return;
    reloadRef.current = () => {
      const { q, page, pageSize } = stateRef.current;
      void load(q, page, pageSize);
    };
    return () => { reloadRef.current = null; };
  }, [reloadRef, load]);

  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);
  const template = columns.map(column => column.width ?? "1fr").join(" ");

  return (
    <section className="panel dt">
      <header className="dt__head">
        <div className="dt__title">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="dt__action">{action}</div>}
      </header>

      <div className="dt__toolbar">
        <div className="dt__search">
          <Search size={16} aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder={`Cari ${searchHint}…`}
            aria-label={`Cari di ${title}`}
            autoComplete="off"
            spellCheck={false}
          />
          {input && (
            <button type="button" aria-label="Bersihkan pencarian" onClick={() => setInput("")}>
              <X size={15} />
            </button>
          )}
          {pending && <Loader2 className="dt__spinner" size={15} aria-hidden="true" />}
        </div>

        <label className="dt__pagesize">
          <span>Baris</span>
          <select
            value={data.pageSize}
            onChange={event => void load(data.q, 1, Number(event.target.value))}
            disabled={pending}
          >
            {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      {/* Pencarian mencakup seluruh data, bukan halaman yang sedang tampil —
          dikatakan langsung supaya tidak perlu ditebak. */}
      <p className="dt__status" role="status">
        {data.q
          ? <>Menampilkan {from}–{to} dari <strong>{data.total.toLocaleString("id-ID")}</strong> hasil untuk “{data.q}” di seluruh data.</>
          : <>Menampilkan {from}–{to} dari <strong>{data.total.toLocaleString("id-ID")}</strong> baris.</>}
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className={`dt__table ${pending ? "is-pending" : ""}`} style={{ "--dt-cols": template } as React.CSSProperties}>
        <div className="dt__row dt__row--head" role="row">
          {columns.map(column => (
            <span
              key={column.key}
              role="columnheader"
              className={`${column.numeric ? "is-numeric" : ""} ${column.secondary ? "is-secondary" : ""}`}
            >
              {column.label}
            </span>
          ))}
        </div>

        {data.rows.length === 0 && (
          <p className="dt__empty">
            {data.q ? `Tidak ada hasil untuk “${data.q}”. Coba kata kunci lain.` : emptyMessage}
          </p>
        )}

        {data.rows.map(row => (
          <div className="dt__row" role="row" key={String(row.id)}>
            {columns.map(column => (
              <span
                key={column.key}
                role="cell"
                data-label={column.label}
                className={`${column.numeric ? "is-numeric" : ""} ${column.secondary ? "is-secondary" : ""}`}
              >
                {column.render ? column.render(row as Row) : formatCell(row[column.key])}
              </span>
            ))}
          </div>
        ))}
      </div>

      {data.pageCount > 1 && (
        <nav className="dt__pager" aria-label={`Navigasi halaman ${title}`}>
          <button
            type="button"
            className="dt__pagebtn"
            onClick={() => void load(data.q, data.page - 1, data.pageSize)}
            disabled={pending || data.page <= 1}
          >
            <ChevronLeft size={16} aria-hidden="true" /> Sebelumnya
          </button>

          <span className="dt__pageinfo">
            Halaman <strong>{data.page}</strong> dari {data.pageCount}
          </span>

          <button
            type="button"
            className="dt__pagebtn"
            onClick={() => void load(data.q, data.page + 1, data.pageSize)}
            disabled={pending || data.page >= data.pageCount}
          >
            Berikutnya <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}

/** Nilai mentah yang aman ditampilkan tanpa perender khusus. */
function formatCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="dt__muted">—</span>;
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") return value.toLocaleString("id-ID");
  return String(value);
}
