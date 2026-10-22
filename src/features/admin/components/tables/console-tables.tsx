"use client";

import { useRef } from "react";
import Link from "next/link";
import { FileCheck2, ShieldAlert } from "lucide-react";
import { formatDateTime, formatRupiah, statusLabel } from "@/lib/format";
import type { TablePage, TableRow } from "@/server/admin/tables/types";
import { DataTable, type Column } from "../data-table";
import { BlacklistAddButton, BlacklistRowActions } from "../blacklist-manager";

/**
 * Tabel konsol internal yang isinya murni daftar.
 *
 * Semuanya memakai DataTable yang sama, jadi perilaku pencarian, penomoran
 * halaman, dan tampilan kartu di layar sempit identik di seluruh konsol.
 * Yang berbeda hanya definisi kolomnya.
 *
 * Tabel yang membawa editor sendiri — artikel, transaksi, paket — belum ikut
 * ke sini karena formulirnya perlu dipindahkan bersama, bukan ditempel.
 */

type Props = { initial: TablePage; searchHint: string; action?: React.ReactNode };

function timeCell(value: unknown) {
  return value ? <span className="dt__muted">{formatDateTime(value as string)}</span> : <span className="dt__muted">—</span>;
}

/* ── Audit log ────────────────────────────────────────────────────────────── */

export function AuditTable({ initial, searchHint }: Props) {
  const columns: Array<Column<TableRow>> = [
    {
      key: "action",
      label: "Aksi",
      width: "minmax(0, 1.4fr)",
      // Kode mentah hanya ditampilkan bila memang belum punya terjemahan;
      // menuliskan keduanya untuk aksi yang sama hanya mengulang baris.
      render: row => {
        const code = String(row.action);
        const label = statusLabel(code);
        return (
          <span className="dt-primary">
            <strong>{label}</strong>
            {label !== code ? <span>{code}</span> : null}
          </span>
        );
      },
    },
    {
      key: "actorName",
      label: "Aktor",
      width: "minmax(0, 1fr)",
      render: row => row.actorId
        ? <Link className="dt-link" href={`/superadmin/users/${String(row.actorId)}`}>{String(row.actorName)}</Link>
        : <span className="dt__muted">{String(row.actorName)}</span>,
    },
    {
      key: "entityType",
      label: "Target",
      width: "minmax(0, 1.1fr)",
      render: row => (
        <span className="dt-primary">
          <strong>{String(row.entityType)}</strong>
          {row.entityId ? <span>{String(row.entityId)}</span> : null}
        </span>
      ),
    },
    { key: "createdAt", label: "Waktu", width: "minmax(0, 0.9fr)", render: row => timeCell(row.createdAt) },
  ];

  return (
    <DataTable
      resource="audit"
      title="Aktivitas platform"
      description="Perubahan penting yang tercatat otomatis. Catatan audit tidak pernah dihapus oleh pembersihan retensi."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      emptyMessage="Belum ada aktivitas tercatat."
    />
  );
}

/* ── Pesan formulir kontak ────────────────────────────────────────────────── */

export function ContactTable({ initial, searchHint }: Props) {
  const columns: Array<Column<TableRow>> = [
    {
      key: "name",
      label: "Pengirim",
      width: "minmax(0, 1fr)",
      render: row => (
        <span className="dt-primary">
          <strong>{String(row.name)}</strong>
          <span>{String(row.email)}</span>
        </span>
      ),
    },
    { key: "company", label: "Bisnis", width: "minmax(0, 0.8fr)", secondary: true },
    {
      key: "message",
      label: "Pesan",
      width: "minmax(0, 2fr)",
      render: row => <span>{String(row.message)}</span>,
    },
    { key: "createdAt", label: "Masuk", width: "minmax(0, 0.8fr)", render: row => timeCell(row.createdAt) },
  ];

  return (
    <DataTable
      resource="contact"
      title="Pesan dari formulir kontak"
      description="Permintaan dari calon pengguna yang belum memiliki akun."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      emptyMessage="Belum ada pesan masuk."
    />
  );
}

/* ── Koneksi Threads ──────────────────────────────────────────────────────── */

const CONNECTION_TONE: Record<string, string> = {
  CONNECTED: "ok",
  PENDING: "warn",
  EXPIRED: "warn",
  REVOKED: "risk",
  ERROR: "risk",
};

export function ConnectionsTable({ initial, searchHint }: Props) {
  const columns: Array<Column<TableRow>> = [
    {
      key: "userName",
      label: "Pemilik",
      width: "minmax(0, 1.3fr)",
      render: row => (
        <span className="dt-primary">
          <Link className="dt-link" href={`/superadmin/users/${String(row.userId)}`}>{String(row.userName)}</Link>
          <span>{row.userEmail ? String(row.userEmail) : "Email placeholder"}</span>
        </span>
      ),
    },
    {
      key: "username",
      label: "Akun Threads",
      width: "minmax(0, 1fr)",
      render: row => row.username ? <span>@{String(row.username)}</span> : <span className="dt__muted">Belum tersambung</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "minmax(0, 0.9fr)",
      render: row => (
        <span className="dt-primary">
          <span className={`dt-badge dt-badge--${CONNECTION_TONE[String(row.status)] ?? "warn"}`}>
            {statusLabel(String(row.status))}
          </span>
          {row.lastErrorCode ? <span>{String(row.lastErrorCode)}</span> : null}
        </span>
      ),
    },
    {
      key: "tokenKind",
      label: "Token",
      width: "minmax(0, 0.9fr)",
      secondary: true,
      render: row => (
        <span className="dt-primary">
          <strong>{statusLabel(String(row.tokenKind))}</strong>
          <span>{row.tokenExpiresAt ? `Berlaku s.d. ${formatDateTime(row.tokenExpiresAt as string)}` : "Tanpa masa berlaku"}</span>
        </span>
      ),
    },
    { key: "searchCount", label: "Pencarian", width: "minmax(0, 0.6fr)", numeric: true },
    { key: "replyCount", label: "Balasan", width: "minmax(0, 0.6fr)", numeric: true },
  ];

  return (
    <DataTable
      resource="connections"
      title="Koneksi Threads per pengguna"
      description="Status token dan pemakaian kumulatif. Nilai token tidak pernah ditampilkan di panel ini."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      emptyMessage="Belum ada koneksi Threads."
    />
  );
}

/* ── Kredensial API mobile ────────────────────────────────────────────────── */

const CREDENTIAL_TONE: Record<string, string> = { ACTIVE: "ok", EXPIRED: "warn", REVOKED: "risk" };
const CREDENTIAL_STATE: Record<string, string> = { ACTIVE: "Aktif", EXPIRED: "Kedaluwarsa", REVOKED: "Dicabut" };

export function CredentialsTable({ initial, searchHint, action }: Props) {
  const columns: Array<Column<TableRow>> = [
    {
      key: "name",
      label: "Perangkat",
      width: "minmax(0, 1.3fr)",
      render: row => (
        <span className="dt-primary">
          <strong>{String(row.name)}</strong>
          <span>{String(row.keyPrefix)}… · {statusLabel(String(row.source))}</span>
        </span>
      ),
    },
    {
      key: "userName",
      label: "Pemilik",
      width: "minmax(0, 1fr)",
      render: row => <Link className="dt-link" href={`/superadmin/users/${String(row.userId)}`}>{String(row.userName)}</Link>,
    },
    {
      key: "state",
      label: "Status",
      width: "minmax(0, 0.8fr)",
      render: row => (
        <span className={`dt-badge dt-badge--${CREDENTIAL_TONE[String(row.state)] ?? "warn"}`}>
          {CREDENTIAL_STATE[String(row.state)] ?? statusLabel(String(row.state))}
        </span>
      ),
    },
    { key: "lastUsedAt", label: "Terakhir dipakai", width: "minmax(0, 0.9fr)", render: row => timeCell(row.lastUsedAt) },
    { key: "expiresAt", label: "Kedaluwarsa", width: "minmax(0, 0.9fr)", secondary: true, render: row => timeCell(row.expiresAt) },
  ];

  return (
    <DataTable
      resource="credentials"
      title="Token aplikasi mobile"
      description="Token yang diterbitkan sendiri oleh pengguna maupun oleh Superadmin. Nilai token hanya tampil sekali saat diterbitkan."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      action={action}
      emptyMessage="Belum ada token diterbitkan."
    />
  );
}

/* ── Artikel ──────────────────────────────────────────────────────────────── */

const ARTICLE_TONE: Record<string, string> = {
  PUBLISHED: "ok",
  SCHEDULED: "brand",
  IN_REVIEW: "warn",
  DRAFT: "",
  ARCHIVED: "risk",
};

export function ArticlesTable({ initial, searchHint, action }: Props) {
  const columns: Array<Column<TableRow>> = [
    {
      key: "title",
      label: "Artikel",
      width: "minmax(0, 2fr)",
      render: row => (
        <span className="dt-primary">
          <strong>{String(row.title)}</strong>
          <span>/blog/{String(row.slug)}</span>
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "minmax(0, 0.9fr)",
      render: row => {
        const tone = ARTICLE_TONE[String(row.status)];
        return <span className={`dt-badge ${tone ? `dt-badge--${tone}` : ""}`}>{statusLabel(String(row.status))}</span>;
      },
    },
    { key: "authorName", label: "Penulis", width: "minmax(0, 1fr)", secondary: true },
    {
      key: "publishedAt",
      label: "Jadwal / terbit",
      width: "minmax(0, 1fr)",
      render: row => timeCell(row.publishedAt ?? row.scheduledFor),
    },
    { key: "updatedAt", label: "Diperbarui", width: "minmax(0, 0.9fr)", secondary: true, render: row => timeCell(row.updatedAt) },
  ];

  return (
    <DataTable
      resource="articles"
      title="Arsip artikel"
      description="Seluruh artikel beserta statusnya. Penyuntingan dilakukan di panel editor di bawah."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      action={action}
      emptyMessage="Belum ada artikel."
    />
  );
}

/* ── Istilah terlarang ────────────────────────────────────────────────────── */

export function BlacklistTable({ initial, searchHint }: Props) {
  // Menambah dan menghapus istilah mengubah data di server; tabelnya memuat
  // ulang halaman yang sedang tampil lewat ref ini.
  const reloadRef = useRef<(() => void) | null>(null);

  const columns: Array<Column<TableRow>> = [
    {
      key: "term",
      label: "Istilah",
      width: "minmax(0, 1.1fr)",
      render: row => (
        <span className="dt-primary">
          <strong>{String(row.term)}</strong>
          <span>oleh {String(row.createdByName)}</span>
        </span>
      ),
    },
    {
      key: "reason",
      label: "Alasan",
      width: "minmax(0, 1.6fr)",
      render: row => row.reason ? <span>{String(row.reason)}</span> : <span className="dt__muted">Tanpa catatan</span>,
    },
    {
      key: "isActive",
      label: "Status",
      width: "minmax(0, 0.7fr)",
      render: row => row.isActive
        ? <span className="dt-badge dt-badge--risk"><ShieldAlert size={12} aria-hidden="true" /> Menahan draft</span>
        : <span className="dt-badge">Nonaktif</span>,
    },
    { key: "createdAt", label: "Ditambahkan", width: "minmax(0, 0.9fr)", render: row => timeCell(row.createdAt) },
    {
      key: "actions",
      label: "Aksi",
      width: "minmax(120px, 0.7fr)",
      render: row => (
        <BlacklistRowActions
          id={String(row.id)}
          term={String(row.term)}
          onChanged={() => reloadRef.current?.()}
        />
      ),
    },
  ];

  return (
    <DataTable
      resource="blacklist"
      title="Istilah terlarang"
      description="Draft yang memuat salah satu istilah ini ditahan untuk ditinjau manusia, bukan dikirim."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      action={<BlacklistAddButton onChanged={() => reloadRef.current?.()} />}
      reloadRef={reloadRef}
      emptyMessage="Belum ada istilah terlarang."
    />
  );
}

/* ── Admin platform ───────────────────────────────────────────────────────── */

export function AdminsTable({ initial, searchHint, action }: Props) {
  const columns: Array<Column<TableRow>> = [
    {
      key: "name",
      label: "Akun",
      width: "minmax(0, 1.4fr)",
      render: row => (
        <span className="dt-primary">
          <Link className="dt-link" href={`/superadmin/users/${String(row.id)}`}>{String(row.name)}</Link>
          <span>{String(row.email)}</span>
        </span>
      ),
    },
    {
      key: "role",
      label: "Peran",
      width: "minmax(0, 0.8fr)",
      render: row => (
        <span className={`dt-badge ${row.role === "SUPERADMIN" ? "dt-badge--brand" : ""}`}>
          {statusLabel(String(row.role))}
        </span>
      ),
    },
    {
      key: "permissions",
      label: "Permission",
      width: "minmax(0, 1.6fr)",
      render: row => {
        const permissions = (row.permissions as string[]) ?? [];
        if (row.role === "SUPERADMIN") return <span className="dt__muted">Akses penuh</span>;
        if (permissions.length === 0) return <span className="dt__muted">Belum diberi permission</span>;
        return (
          <span className="dt-actions" style={{ justifyContent: "flex-start" }}>
            {permissions.map(permission => (
              <span className="dt-badge" key={permission}><FileCheck2 size={12} aria-hidden="true" /> {statusLabel(permission)}</span>
            ))}
          </span>
        );
      },
    },
    { key: "lastLoginAt", label: "Masuk terakhir", width: "minmax(0, 0.9fr)", render: row => timeCell(row.lastLoginAt) },
  ];

  return (
    <DataTable
      resource="admins"
      title="Akun internal"
      description="Admin dan Superadmin platform beserta permission yang berlaku."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      action={action}
      emptyMessage="Belum ada akun internal selain Anda."
    />
  );
}

/* ── Arsip transaksi ──────────────────────────────────────────────────────── */

const TRANSACTION_TONE: Record<string, string> = {
  PAID: "ok",
  PENDING: "warn",
  AWAITING_REVIEW: "warn",
  REJECTED: "risk",
  EXPIRED: "risk",
  CANCELLED: "",
};

/**
 * Arsip seluruh transaksi, terpisah dari antrean tinjauan di atasnya.
 *
 * Antrean menjawab "apa yang perlu saya kerjakan sekarang"; arsip ini menjawab
 * "di mana invoice yang ditanyakan pelanggan" — pekerjaan dukungan yang paling
 * sering, dan satu-satunya yang benar-benar butuh pencarian lintas seluruh data.
 */
export function TransactionsTable({ initial, searchHint }: Props) {
  const columns: Array<Column<TableRow>> = [
    {
      key: "invoiceNumber",
      label: "Invoice",
      width: "minmax(0, 1.2fr)",
      render: row => (
        <span className="dt-primary">
          <strong>{String(row.invoiceNumber)}</strong>
          <span>{String(row.planName)} · {String(row.periodMonths)} bulan</span>
        </span>
      ),
    },
    {
      key: "userName",
      label: "Pembayar",
      width: "minmax(0, 1.2fr)",
      render: row => (
        <span className="dt-primary">
          <Link className="dt-link" href={`/superadmin/users/${String(row.userId)}`}>{String(row.userName)}</Link>
          <span>{row.payerName ? `a.n. ${String(row.payerName)}` : row.userEmail ? String(row.userEmail) : "Email placeholder"}</span>
        </span>
      ),
    },
    {
      key: "totalAmount",
      label: "Nominal",
      width: "minmax(0, 0.9fr)",
      numeric: true,
      render: row => <span>{formatRupiah(Number(row.totalAmount))}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "minmax(0, 0.9fr)",
      render: row => {
        const tone = TRANSACTION_TONE[String(row.status)];
        return (
          <span className="dt-primary">
            <span className={`dt-badge ${tone ? `dt-badge--${tone}` : ""}`}>{statusLabel(String(row.status))}</span>
            {row.hasProof ? <span>Bukti terlampir</span> : null}
          </span>
        );
      },
    },
    {
      key: "methodLabel",
      label: "Metode",
      width: "minmax(0, 0.8fr)",
      secondary: true,
      render: row => row.methodLabel
        ? <span>{String(row.methodLabel)}</span>
        : <span className="dt__muted">Belum dipilih</span>,
    },
    {
      key: "createdAt",
      label: "Dibuat",
      width: "minmax(0, 0.9fr)",
      render: row => timeCell(row.createdAt),
    },
  ];

  return (
    <DataTable
      resource="transactions"
      title="Arsip transaksi"
      description="Seluruh tagihan, termasuk yang sudah selesai dan kedaluwarsa. Cari nomor invoice untuk menjawab pertanyaan pelanggan."
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      emptyMessage="Belum ada transaksi."
    />
  );
}
