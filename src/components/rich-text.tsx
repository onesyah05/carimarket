import { Fragment } from "react";
import { parseRichText, type RichInline } from "@/lib/rich-text";

/**
 * Penampil teks berformat.
 *
 * Merakit elemen React dari hasil parsing dan tidak pernah memakai
 * `dangerouslySetInnerHTML`, jadi isi yang ditulis pengguna tidak bisa menjadi
 * markup betapa pun isinya. Tautan dibuka dengan `rel="noreferrer"` karena
 * alamatnya datang dari orang lain.
 */
export function RichText({ value, className }: { value: string; className?: string }) {
  const blocks = parseRichText(value);
  if (blocks.length === 0) return null;

  return <div className={`rich-text ${className ?? ""}`.trim()}>
    {blocks.map((block, index) => block.kind === "paragraph"
      ? <p key={index}>{block.inlines.map(renderInline)}</p>
      : block.ordered
        ? <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item.map(renderInline)}</li>)}</ol>
        : <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item.map(renderInline)}</li>)}</ul>)}
  </div>;
}

function renderInline(inline: RichInline, index: number) {
  switch (inline.kind) {
    case "bold": return <strong key={index}>{inline.value}</strong>;
    case "italic": return <em key={index}>{inline.value}</em>;
    case "code": return <code key={index}>{inline.value}</code>;
    case "link": return <a key={index} href={inline.href} target="_blank" rel="noreferrer nofollow">{inline.value}</a>;
    default: return <Fragment key={index}>{inline.value}</Fragment>;
  }
}
