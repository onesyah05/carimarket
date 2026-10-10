"use client";

import { useState } from "react";
import { API_ENDPOINTS, API_GROUPS, type ApiEndpoint } from "@/server/api/catalog";
import { API_ERROR_CODES } from "@/server/api/response";
import { ApiCredentialsTable, type Credential } from "./api-credentials-table";

/**
 * Dokumentasi API mobile untuk Superadmin.
 *
 * Tiap bagian dipisah menjadi tab agar halaman tidak panjang, dan referensi
 * endpoint memakai akordeon sehingga hanya bagian yang dibuka yang memakan
 * ruang. Isi referensi berasal dari katalog yang sama dengan berkas OpenAPI.
 */

const TABS = [
  { id: "autentikasi", label: "Autentikasi" },
  { id: "format", label: "Format respons" },
  { id: "error", label: "Kode error" },
  { id: "referensi", label: `Referensi endpoint (${API_ENDPOINTS.length})` },
  { id: "token", label: "Token aktif" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function CodeBlock({ children }: { children: string }) {
  return <pre className="api-code"><code>{children}</code></pre>;
}

function placeholderFor(type: string) {
  if (type === "boolean") return true;
  if (type === "number" || type === "integer") return 1;
  if (type === "array") return [];
  if (type === "object") return {};
  return "...";
}

function curlExample(endpoint: ApiEndpoint, baseUrl: string) {
  const path = endpoint.path.replace(/\{(\w+)\}/g, "<$1>");
  const lines = [`curl -X ${endpoint.method} "${baseUrl}${path}"`];
  if (!endpoint.public) lines.push(`  -H "Authorization: Bearer $CARIMARKET_API_TOKEN"`);
  if (endpoint.body?.length) {
    const body = Object.fromEntries(endpoint.body.filter(field => field.required).map(field => [field.name, placeholderFor(field.type)]));
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }
  return lines.join(" \\\n");
}

function EndpointAccordion({ endpoint, baseUrl }: { endpoint: ApiEndpoint; baseUrl: string }) {
  const envelope = {
    success: true,
    data: endpoint.dataExample,
    meta: { requestId: "0f2b7c18-6f1a-4f0d-9d1b-2f1a3b4c5d6e", timestamp: "2026-10-10T08:00:00.000Z" },
  };

  return (
    <details className="api-endpoint-item">
      <summary>
        <span className={`api-method api-method--${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
        <code>{endpoint.path}</code>
        <span className="api-endpoint-item__summary">{endpoint.summary}</span>
        {endpoint.public && <span className="api-public-badge">tanpa token</span>}
      </summary>
      <div className="api-endpoint-item__body">
        {endpoint.description && <p className="api-endpoint__description">{endpoint.description}</p>}

        {endpoint.query && endpoint.query.length > 0 && <>
          <h4>Parameter kueri</h4>
          <ul className="api-field-list">
            {endpoint.query.map(field => (
              <li key={field.name}><code>{field.name}</code> <em>{field.type}</em>{field.required ? <strong> wajib</strong> : null} — {field.description}</li>
            ))}
          </ul>
        </>}

        {endpoint.body && endpoint.body.length > 0 && <>
          <h4>Isi permintaan</h4>
          <ul className="api-field-list">
            {endpoint.body.map(field => (
              <li key={field.name}><code>{field.name}</code> <em>{field.type}</em>{field.required ? <strong> wajib</strong> : null} — {field.description}</li>
            ))}
          </ul>
        </>}

        <h4>Contoh respons</h4>
        <CodeBlock>{JSON.stringify(envelope, null, 2)}</CodeBlock>

        {endpoint.errors && endpoint.errors.length > 0 && (
          <p className="api-endpoint__errors">Kode error khusus: {endpoint.errors.map(code => <code key={code}>{code}</code>)}</p>
        )}

        <h4>Contoh curl</h4>
        <CodeBlock>{curlExample(endpoint, baseUrl)}</CodeBlock>
      </div>
    </details>
  );
}

function AuthPanel() {
  return <div className="api-tab-body">
    <p className="api-lead">Seluruh endpoint selain masuk dan pemasangan memerlukan token pada header berikut. Satu token hanya membuka satu workspace pengguna.</p>
    <CodeBlock>{`Authorization: Bearer cmk_1a2b3c4d_<rahasia>`}</CodeBlock>

    <h3>Tiga jalur memperoleh token</h3>
    <ol className="api-step-list">
      <li>
        <strong>Masuk dari aplikasi</strong>
        <p>Pengguna mengirim email dan kata sandinya ke <code>POST /api/v1/auth/login</code> dan langsung menerima token. Ini jalur utama untuk aplikasi dengan banyak pengguna karena tidak memerlukan campur tangan admin platform sama sekali.</p>
      </li>
      <li>
        <strong>Kode pemasangan</strong>
        <p>Untuk akun yang masuk lewat Threads sehingga belum memiliki kata sandi. Pengguna membuat kode di dashboard web pada Pengaturan, bagian Keamanan dan data, lalu aplikasi menukarnya melalui <code>POST /api/v1/auth/pair</code>. Kode berlaku 10 menit dan hanya dapat dipakai satu kali.</p>
      </li>
      <li>
        <strong>Kunci integrasi internal</strong>
        <p>Dibuat lewat <code>POST /api/admin/api-credentials</code> memakai sesi Superadmin, misalnya untuk pengujian atau integrasi internal. Form penerbitannya tidak lagi ada di halaman ini karena pengguna sudah memperoleh tokennya sendiri.</p>
      </li>
    </ol>

    <h3>Aturan yang berlaku untuk semua token</h3>
    <ul className="api-field-list">
      <li>Token masuk dan pemasangan berlaku 90 hari. Maksimal 10 perangkat aktif per akun, dan perangkat yang paling lama tidak dipakai dicabut otomatis saat batas terlampaui.</li>
      <li>Hanya hash SHA-256 token yang disimpan. Nilai token hanya muncul sekali pada respons penerbitan dan tidak pernah dapat dibaca ulang.</li>
      <li>Token yang dicabut atau kedaluwarsa dijawab <code>CREDENTIAL_REVOKED</code> atau <code>CREDENTIAL_EXPIRED</code>. Pengguna dapat mencabut perangkatnya sendiri dari aplikasi maupun dashboard web.</li>
      <li>Batas laju 120 permintaan per menit per token, 20 per menit per alamat IP untuk endpoint tanpa token, dan 10 percobaan masuk per 5 menit per email.</li>
      <li>Cakupan API hanya menu pengguna. Tidak ada endpoint admin atau superadmin, dan token ditolak bila pemiliknya bukan akun pengguna bisnis yang aktif.</li>
    </ul>
  </div>;
}

function FormatPanel() {
  return <div className="api-tab-body">
    <p className="api-lead">Setiap respons memakai amplop yang sama, termasuk saat gagal, sehingga klien hanya perlu satu jalur penguraian.</p>
    <h3>Berhasil</h3>
    <CodeBlock>{`{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "0f2b7c18-6f1a-4f0d-9d1b-2f1a3b4c5d6e",
    "timestamp": "2026-10-10T08:00:00.000Z",
    "page": { "page": 1, "perPage": 20, "total": 42, "totalPages": 3, "hasMore": true }
  }
}`}</CodeBlock>
    <h3>Gagal</h3>
    <CodeBlock>{`{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Kuota pencarian paket Bisnis bulan ini sudah terpakai (2000/2000).",
    "details": null
  },
  "meta": { "requestId": "…", "timestamp": "…" }
}`}</CodeBlock>
    <h3>Ketentuan isi</h3>
    <ul className="api-field-list">
      <li><code>meta.page</code> hanya muncul pada endpoint berbentuk daftar.</li>
      <li><code>error.details</code> memuat pemetaan nama kolom ke pesan saat validasi gagal, selain itu <code>null</code>.</li>
      <li>Semua waktu memakai ISO 8601 UTC.</li>
      <li>Metrik yang tidak diketahui bernilai <code>null</code>, bukan nol, agar tidak menyesatkan.</li>
      <li>Nilai enum dikirim apa adanya dan ditemani <code>statusLabel</code> siap tampil.</li>
      <li>Header <code>X-Request-Id</code> berisi nilai yang sama dengan <code>meta.requestId</code> untuk penelusuran log.</li>
    </ul>
  </div>;
}

function ErrorPanel() {
  return <div className="api-tab-body">
    <p className="api-lead">Kode error didaftarkan di satu tempat pada kode sumber, jadi dokumentasi ini tidak dapat berbeda dari implementasinya.</p>
    <div className="data-table internal-table">
      <div className="data-row data-head data-row--3"><span>Kode</span><span>HTTP</span><span>Arti</span></div>
      {Object.entries(API_ERROR_CODES).map(([code, detail]) => (
        <div className="data-row data-row--3" key={code}>
          <span data-label="Kode"><code>{code}</code></span>
          <span data-label="HTTP">{detail.status}</span>
          <span data-label="Arti">{detail.message}</span>
        </div>
      ))}
    </div>
  </div>;
}

function ReferencePanel({ baseUrl }: { baseUrl: string }) {
  const groups = API_GROUPS.map(group => ({
    ...group,
    endpoints: API_ENDPOINTS.filter(endpoint => endpoint.group === group.name),
  }));

  return <div className="api-tab-body">
    <p className="api-lead">Buka kelompok yang Anda butuhkan. Setiap endpoint dapat dibuka terpisah beserta parameter, contoh respons, dan contoh curl.</p>
    <div className="api-accordion">
      {groups.map(group => (
        <details className="api-group" key={group.name}>
          <summary>
            <span className="api-group__name">{group.name}</span>
            <span className="api-group__count">{group.endpoints.length} endpoint</span>
            <span className="api-group__description">{group.description}</span>
          </summary>
          <div className="api-group__body">
            {group.endpoints.map(endpoint => <EndpointAccordion key={`${endpoint.method} ${endpoint.path}`} endpoint={endpoint} baseUrl={baseUrl} />)}
          </div>
        </details>
      ))}
    </div>
  </div>;
}

export function ApiDocs({ baseUrl, credentials }: { baseUrl: string; credentials: Credential[] }) {
  const [active, setActive] = useState<TabId>("autentikasi");

  return <section className="api-docs">
    <nav className="api-tabs" aria-label="Bagian dokumentasi API">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? "active" : ""}
          aria-current={active === tab.id ? "page" : undefined}
          onClick={() => setActive(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>

    <div className="panel api-tab-panel">
      {active === "autentikasi" && <AuthPanel />}
      {active === "format" && <FormatPanel />}
      {active === "error" && <ErrorPanel />}
      {active === "referensi" && <ReferencePanel baseUrl={baseUrl} />}
      {active === "token" && <div className="api-tab-body">
        <p className="api-lead">Token yang pernah dibuat pada platform ini, termasuk yang dibuat pengguna sendiri lewat masuk dari aplikasi atau kode pemasangan. Nilai token tidak pernah ditampilkan ulang; kolom token hanya memuat prefiksnya.</p>
        <ApiCredentialsTable credentials={credentials} />
      </div>}
    </div>
  </section>;
}
