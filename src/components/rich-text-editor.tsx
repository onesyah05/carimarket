"use client";

import { useId, useRef, useState } from "react";
import { Bold, Code, Eye, Italic, Link2, List, ListOrdered, PenLine } from "lucide-react";
import { RichText } from "@/components/rich-text";

/**
 * Isian teks panjang dengan penanda format.
 *
 * Tetap sebuah `<textarea>` di bawahnya, bukan `contenteditable`. Itu disengaja:
 * textarea sudah membawa pemeriksaan bawaan peramban, `maxLength`, dukungan
 * pembaca layar, dan urung-ketik, sementara contenteditable harus menulis ulang
 * semuanya dan mengembalikan HTML yang perlu dibersihkan sebelum disimpan.
 * Tombol di sini hanya menyisipkan penanda Markdown ke teksnya, dan tombol
 * Pratinjau menampilkan hasil akhirnya dengan penampil yang sama persis dengan
 * yang dipakai saat isinya ditampilkan kembali.
 */

type Props = {
  id?: string;
  name?: string;
  /** Mode terkendali. Kosongkan keduanya untuk memakai `defaultValue`. */
  value?: string;
  onChange?: (value: string) => void;
  /** Mode tak terkendali, untuk form yang dibaca lewat FormData. */
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

export function RichTextEditor({ id, name, value, onChange, defaultValue = "", rows = 6, placeholder, disabled = false, required = false, minLength, maxLength }: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const [preview, setPreview] = useState(false);
  // Banyak form di aplikasi ini tak terkendali dan dibaca lewat FormData saat
  // dikirim. Menjadikan editor ini wajib terkendali berarti menulis ulang
  // form-form itu hanya untuk mengganti satu isian, jadi ia menyimpan
  // nilainya sendiri ketika `value` tidak diberikan.
  const [own, setOwn] = useState(defaultValue);
  const text = value ?? own;
  const setText = (next: string) => { setOwn(next); onChange?.(next); };

  /**
   * Membungkus teks terpilih, atau menyisipkan penanda lalu menaruh kursor di
   * antaranya ketika tidak ada yang terpilih — supaya menekan tombol tanpa
   * memilih apa pun tetap terasa benar.
   */
  function wrap(before: string, after: string = before) {
    const area = areaRef.current;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end } = area;
    const selected = text.slice(start, end);
    const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  /** Menandai tiap baris terpilih, karena daftar selalu soal baris. */
  function prefixLines(marker: (index: number) => string) {
    const area = areaRef.current;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end } = area;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = text.indexOf("\n", end) === -1 ? text.length : text.indexOf("\n", end);
    const block = text.slice(lineStart, lineEnd) || "";
    const marked = block.split("\n").map((line, index) => `${marker(index)}${line}`).join("\n");
    const next = `${text.slice(0, lineStart)}${marked}${text.slice(lineEnd)}`;
    setText(next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(lineStart, lineStart + marked.length);
    });
  }

  return (
    <div className={`rich-editor ${disabled ? "is-disabled" : ""}`.trim()}>
      <div className="rich-editor__bar" role="group" aria-label="Format teks">
        <button type="button" onClick={() => wrap("**")} disabled={disabled || preview} title="Tebal" aria-label="Tebal"><Bold size={15} /></button>
        <button type="button" onClick={() => wrap("*")} disabled={disabled || preview} title="Miring" aria-label="Miring"><Italic size={15} /></button>
        <button type="button" onClick={() => wrap("`")} disabled={disabled || preview} title="Kode" aria-label="Kode"><Code size={15} /></button>
        <button type="button" onClick={() => prefixLines(() => "- ")} disabled={disabled || preview} title="Daftar" aria-label="Daftar"><List size={15} /></button>
        <button type="button" onClick={() => prefixLines(index => `${index + 1}. `)} disabled={disabled || preview} title="Daftar bernomor" aria-label="Daftar bernomor"><ListOrdered size={15} /></button>
        <button type="button" onClick={() => wrap("https://", "")} disabled={disabled || preview} title="Tautan" aria-label="Tautan"><Link2 size={15} /></button>
        <button
          type="button"
          className={`rich-editor__preview ${preview ? "is-on" : ""}`.trim()}
          onClick={() => setPreview(current => !current)}
          disabled={disabled}
          aria-pressed={preview}
        >
          {preview ? <><PenLine size={14} /> Tulis</> : <><Eye size={14} /> Pratinjau</>}
        </button>
      </div>

      {preview
        ? <div className="rich-editor__preview-pane">
          {text.trim() === ""
            ? <p className="rich-editor__empty">Belum ada yang ditulis.</p>
            : <RichText value={text} />}
        </div>
        : <textarea
          ref={areaRef}
          className="input rich-editor__area"
          id={fieldId}
          name={name}
          value={text}
          onChange={event => setText(event.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
        />}
    </div>
  );
}
