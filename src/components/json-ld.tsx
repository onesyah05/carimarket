/**
 * Structured data JSON-LD.
 *
 * Dibuat satu komponen supaya setiap halaman tidak mengulang pemanggilan
 * `dangerouslySetInnerHTML`. Nilainya selalu melewati `JSON.stringify`, jadi
 * teks dari CMS tidak dapat keluar dari blok skrip; `<` tetap dilolosi karena
 * urutan `</script` di dalam string akan menutup tag lebih awal.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
