"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { History, Search } from "lucide-react";
import { matchSuggestions, suggestionMeta, type KeywordSuggestion } from "@/lib/keyword-suggestions";

/**
 * Kolom pencarian lead dengan riwayat kata kunci.
 *
 * Kata kunci yang dipakai pelanggan biasanya berulang dan panjang ("cari jasa
 * pembuatan website"), dan mengetik ulang salah satu huruf saja sudah
 * menghasilkan kata kunci baru yang memakan jatah paket. Menawarkan kembali
 * apa yang pernah dipakai membuat pengulangan itu sekali klik, sekaligus
 * mengurangi kata kunci kembar yang tidak disengaja.
 *
 * Memilih saran langsung menjalankan pencarian: itulah maksud memilihnya.
 */
export function KeywordSuggestInput({ value, suggestions, disabled, onChange, onSearch }: {
  value: string;
  suggestions: KeywordSuggestion[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
}) {
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const visible = useMemo(() => matchSuggestions(suggestions, value), [suggestions, value]);
  const expanded = open && visible.length > 0;

  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [expanded]);

  function choose(suggestion: KeywordSuggestion) {
    onChange(suggestion.phrase);
    setOpen(false);
    setHighlight(-1);
    onSearch(suggestion.phrase);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (visible.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight(current => {
        const next = current + step;
        if (next < 0) return visible.length - 1;
        if (next >= visible.length) return 0;
        return next;
      });
      return;
    }
    // Enter memilih saran yang sedang disorot; tanpa sorotan, form tetap
    // dikirim seperti biasa.
    if (event.key === "Enter" && expanded && highlight >= 0) {
      event.preventDefault();
      choose(visible[highlight]);
    }
  }

  return (
    <div className="keyword-suggest" ref={wrapperRef}>
      <label className="filter-search">
        <Search size={17} />
        <input
          value={value}
          onChange={event => { onChange(event.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          // Klik juga membuka: setelah Escape kolomnya masih fokus, jadi
          // tanpa ini daftar tidak bisa dipanggil kembali tanpa mengetik.
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Cari kata kunci di Threads"
          aria-label="Cari lead di Threads"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && highlight >= 0 ? optionId(highlight) : undefined}
          autoComplete="off"
          disabled={disabled}
        />
      </label>

      {expanded && (
        <ul className="keyword-suggest__list" id={listId} role="listbox" aria-label="Kata kunci yang pernah dipakai">
          <li className="keyword-suggest__caption" role="presentation">
            <History size={13} /> Pernah Anda pakai
          </li>
          {visible.map((suggestion, index) => (
            <li
              key={suggestion.phrase}
              id={optionId(index)}
              role="option"
              aria-selected={index === highlight}
              className={index === highlight ? "is-active" : ""}
            >
              <button type="button" onMouseEnter={() => setHighlight(index)} onClick={() => choose(suggestion)}>
                <strong>{suggestion.phrase}</strong>
                <span>{suggestionMeta(suggestion)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
