/**
 * Teks berformat untuk isian panjang di seluruh aplikasi.
 *
 * Yang disimpan tetap teks biasa bergaya Markdown, bukan HTML. Alasannya
 * keamanan, bukan selera: isi tiket dukungan, catatan admin, dan artikel CMS
 * ditulis orang lalu ditampilkan ke orang lain — termasuk ke staf di konsol
 * internal. Bila yang disimpan HTML, setiap tempat yang menampilkannya harus
 * ingat membersihkannya, dan satu tempat yang lupa sudah cukup untuk menjadi
 * XSS. Dengan Markdown, penampilnya merakit elemen React dari hasil parsing
 * dan tidak pernah menyuntik HTML mentah, jadi tidak ada yang perlu diingat.
 *
 * Himpunan formatnya sengaja kecil: tebal, miring, kode, tautan, dan dua jenis
 * daftar. Itu yang benar-benar dipakai saat melaporkan kendala.
 */

export type RichInline =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; value: string; href: string };

export type RichBlock =
  | { kind: "paragraph"; inlines: RichInline[] }
  | { kind: "heading"; level: 2 | 3; inlines: RichInline[] }
  | { kind: "list"; ordered: boolean; items: RichInline[][] };

const UNORDERED = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
/* Artikel CMS sudah memakai `## ` sebelum ada penampil bersama ini, jadi
   judulnya harus ikut dikenali agar isi yang sudah terbit tidak berubah. */
const HEADING = /^(#{2,3})\s+(.*)$/;

/** Hanya skema yang aman dibuka dari tautan yang dibuat pengguna. */
function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  return /^https?:\/\/[^\s<>]+$/i.test(trimmed) ? trimmed : null;
}

/**
 * Memecah satu baris menjadi potongan bergaya.
 *
 * Penanda diproses berurutan dari yang paling spesifik: kode lebih dulu agar
 * `**` di dalam backtick tidak ikut dibaca sebagai tebal.
 */
export function parseInline(line: string): RichInline[] {
  const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(https?:\/\/[^\s<>]+)/g;
  const out: RichInline[] = [];
  let last = 0;

  for (let match = pattern.exec(line); match !== null; match = pattern.exec(line)) {
    if (match.index > last) out.push({ kind: "text", value: line.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith("`")) out.push({ kind: "code", value: token.slice(1, -1) });
    else if (token.startsWith("**")) out.push({ kind: "bold", value: token.slice(2, -2) });
    else if (token.startsWith("*")) out.push({ kind: "italic", value: token.slice(1, -1) });
    else {
      const href = safeHref(token);
      if (href) out.push({ kind: "link", value: token, href });
      else out.push({ kind: "text", value: token });
    }
    last = match.index + token.length;
  }

  if (last < line.length) out.push({ kind: "text", value: line.slice(last) });
  return out.length > 0 ? out : [{ kind: "text", value: line }];
}

export function parseRichText(value: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    // Baris di dalam satu paragraf disambung dengan spasi, bukan digabung
    // rapat: orang menekan Enter di tengah kalimat dan tidak bermaksud
    // menempelkan kata terakhir ke kata pertama baris berikutnya.
    blocks.push({ kind: "paragraph", inlines: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list === null) return;
    blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const rawLine of value.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: heading[1].length === 2 ? 2 : 3, inlines: parseInline(heading[2].trim()) });
      continue;
    }

    const unordered = UNORDERED.exec(line);
    const ordered = unordered ? null : ORDERED.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = ordered !== null;
      const text = (unordered?.[1] ?? ordered?.[1] ?? "").trim();
      if (list !== null && list.ordered !== isOrdered) flushList();
      if (list === null) list = { ordered: isOrdered, items: [] };
      list.items.push(text);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/**
 * Versi satu baris tanpa penanda, untuk tempat yang memang hanya boleh teks
 * polos: ringkasan email, cuplikan di daftar, dan judul.
 */
export function richTextToPlain(value: string): string {
  return parseRichText(value)
    .flatMap(block => block.kind === "list" ? block.items : [block.inlines])
    .map(inlines => inlines.map(inline => inline.value).join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
