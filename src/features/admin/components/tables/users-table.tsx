"use client";

import { useRef } from "react";
import Link from "next/link";
import { statusLabel, formatDateTime } from "@/lib/format";
import type { TablePage, TableRow } from "@/server/admin/tables/types";
import { DataTable, type Column } from "../data-table";
import { UserRowActions } from "../user-row-actions";

/**
 * Daftar pengguna.
 *
 * `canModerate` memisahkan apa yang boleh dilakukan tiap peran: Admin menambah
 * dan melihat akun, sedangkan menangguhkan akun atau mencabut koneksi Threads
 * tetap milik Superadmin — sama seperti yang ditegakkan API-nya. Kolom aksi
 * karena itu hanya muncul untuk Superadmin; Admin tetap dapat membuka detail.
 */

type Props = {
  initial: TablePage;
  searchHint: string;
  canModerate?: boolean;
  /** Awalan rute detail, berbeda antara konsol Admin dan Superadmin. */
  detailBase: string;
  action?: React.ReactNode;
};

function statusBadge(status: string) {
  const tone = status === "ACTIVE" ? "ok" : status === "SUSPENDED" ? "risk" : "warn";
  return <span className={`dt-badge dt-badge--${tone}`}>{statusLabel(status)}</span>;
}

export function UsersTable({ initial, searchHint, canModerate = true, detailBase, action }: Props) {
  // Tindakan baris mengubah data di server; ini meminta DataTable memuat ulang
  // halaman yang sedang tampil tanpa memuat ulang seluruh rute.
  const reloadRef = useRef<(() => void) | null>(null);

  const columns: Array<Column<TableRow>> = [
    {
      key: "name",
      label: "Pengguna",
      width: "minmax(0, 1.6fr)",
      render: row => (
        <span className="dt-primary">
          <Link className="dt-link" href={`${detailBase}/${String(row.id)}`}>{String(row.name)}</Link>
          <span>
            {row.emailIsPlaceholder
              ? "Email placeholder (pendaftaran Threads)"
              : String(row.email ?? "—")}
            {!row.emailIsPlaceholder && row.emailVerified === false ? " · belum terverifikasi" : ""}
          </span>
        </span>
      ),
    },
    {
      key: "businessName",
      label: "Bisnis",
      width: "minmax(0, 1.2fr)",
      render: row => (
        <span className="dt-primary">
          <strong>{row.businessName ? String(row.businessName) : "—"}</strong>
          <span>
            {Number(row.profileCount) > 1 ? `${row.profileCount} jasa · ` : ""}
            {Number(row.keywordCount).toLocaleString("id-ID")} kata kunci
          </span>
        </span>
      ),
    },
    {
      key: "role",
      label: "Peran",
      width: "minmax(0, 0.7fr)",
      secondary: true,
      render: row => <span className="dt-badge">{statusLabel(String(row.role))}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "minmax(0, 0.8fr)",
      render: row => statusBadge(String(row.status)),
    },
    {
      key: "planName",
      label: "Paket",
      width: "minmax(0, 0.8fr)",
      render: row => row.planName
        ? <span className="dt-badge dt-badge--brand">{String(row.planName)}</span>
        : <span className="dt__muted">Belum berlangganan</span>,
    },
    {
      key: "leadCount",
      label: "Lead",
      width: "minmax(0, 0.45fr)",
      numeric: true,
      secondary: true,
    },
    canModerate
      ? {
        key: "actions",
        label: "Aksi",
        width: "minmax(170px, 1.4fr)",
        render: row => (
          <span className="dt-actions">
            {row.role === "SUPERADMIN"
              ? <span className="dt__muted">Akun tertinggi</span>
              : <UserRowActions
                userId={String(row.id)}
                name={String(row.name)}
                status={row.status as "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION"}
                category={(row.businessCategory as string | null) ?? null}
                onChanged={() => reloadRef.current?.()}
              />}
          </span>
        ),
      }
      : {
        key: "createdAt",
        label: "Terdaftar",
        width: "minmax(0, 0.9fr)",
        render: row => <span className="dt__muted">{formatDateTime(row.createdAt as string)}</span>,
      },
  ];

  return (
    <DataTable
      resource="users"
      title="Daftar pengguna"
      description={canModerate
        ? "Klik nama untuk membuka detail akun. Pencarian mencakup seluruh pengguna, bukan hanya halaman ini."
        : "Klik nama untuk membuka detail akun. Menangguhkan akun dan mencabut koneksi tetap milik Superadmin."}
      searchHint={searchHint}
      columns={columns}
      initial={initial}
      action={action}
      emptyMessage="Belum ada pengguna terdaftar."
      reloadRef={reloadRef}
    />
  );
}
