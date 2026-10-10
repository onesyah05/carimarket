import { endpointsByGroup, type ApiEndpoint } from "@/server/api/catalog";
import { API_ERROR_CODES } from "@/server/api/response";

/**
 * Dokumentasi API mobile.
 *
 * Dirender dari katalog endpoint yang sama dengan berkas OpenAPI, dan hanya
 * tampil di area Superadmin.
 */

function CodeBlock({ children }: { children: string }) {
  return <pre className="api-code"><code>{children}</code></pre>;
}

function EndpointCard({ endpoint, baseUrl }: { endpoint: ApiEndpoint; baseUrl: string }) {
  const envelope = {
    success: true,
    data: endpoint.dataExample,
    meta: { requestId: "0f2b7c18-6f1a-4f0d-9d1b-2f1a3b4c5d6e", timestamp: "2026-10-10T08:00:00.000Z" },
  };

  return (
    <article className="api-endpoint" id={`${endpoint.method}-${endpoint.path}`}>
      <header>
        <span className={`api-method api-method--${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
        <code>{endpoint.path}</code>
        {endpoint.public && <span className="api-public-badge">tanpa token</span>}
      </header>
      <p className="api-endpoint__summary">{endpoint.summary}</p>
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

      <details className="api-endpoint__curl">
        <summary>Contoh curl</summary>
        <CodeBlock>{curlExample(endpoint, baseUrl)}</CodeBlock>
      </details>
    </article>
  );
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

function placeholderFor(type: string) {
  if (type === "boolean") return true;
  if (type === "number" || type === "integer") return 1;
  if (type === "array") return [];
  if (type === "object") return {};
  return "...";
}

export function ApiReference({ baseUrl }: { baseUrl: string }) {
  const groups = endpointsByGroup();

  return (
    <section className="api-reference">
      <article className="panel api-doc-panel">
        <h2>Autentikasi</h2>
        <p>Seluruh endpoint selain masuk dan pemasangan memerlukan token pada header berikut. Satu token hanya membuka satu workspace.</p>
        <CodeBlock>{`Authorization: Bearer cmk_1a2b3c4d_<rahasia>`}</CodeBlock>
        <p>Token diperoleh melalui tiga jalur:</p>
        <ul className="api-field-list">
          <li><strong>Masuk dari aplikasi</strong> — <code>POST /api/v1/auth/login</code> dengan email dan kata sandi pengguna. Jalur utama untuk aplikasi yang dipakai banyak pengguna; tidak perlu campur tangan Superadmin.</li>
          <li><strong>Kode pemasangan</strong> — pengguna membuat kode di dashboard web (Pengaturan, Keamanan dan data) lalu menukarnya lewat <code>POST /api/v1/auth/pair</code>. Dipakai akun yang masuk lewat Threads sehingga belum memiliki kata sandi.</li>
          <li><strong>Kunci terbitan Superadmin</strong> — dibuat di halaman ini untuk integrasi internal atau pengujian. Tidak dipakai untuk pendaftaran pengguna massal.</li>
        </ul>
        <ul className="api-field-list">
          <li>Token login dan pemasangan berlaku 90 hari; maksimal 10 perangkat aktif per akun, dan perangkat terlama otomatis dicabut saat batas terlampaui.</li>
          <li>Hanya hash SHA-256 token yang disimpan. Nilai token hanya muncul sekali pada respons penerbitan.</li>
          <li>Token yang dicabut atau kedaluwarsa dijawab <code>CREDENTIAL_REVOKED</code> atau <code>CREDENTIAL_EXPIRED</code>. Pengguna dapat mencabut perangkatnya sendiri lewat aplikasi maupun dashboard web.</li>
          <li>Batas laju 120 permintaan per menit per token, dan 20 per menit per alamat IP untuk endpoint tanpa token.</li>
          <li>Cakupan API hanya menu pengguna. Tidak ada endpoint admin, superadmin, maupun data workspace lain.</li>
        </ul>
      </article>

      <article className="panel api-doc-panel">
        <h2>Format respons</h2>
        <p>Seluruh endpoint memakai amplop yang sama, termasuk saat gagal, sehingga klien hanya perlu satu jalur penguraian. Header <code>X-Request-Id</code> berisi nilai yang sama dengan <code>meta.requestId</code> untuk penelusuran.</p>
        <CodeBlock>{`{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "0f2b7c18-6f1a-4f0d-9d1b-2f1a3b4c5d6e",
    "timestamp": "2026-10-10T08:00:00.000Z",
    "page": { "page": 1, "perPage": 20, "total": 42, "totalPages": 3, "hasMore": true }
  }
}`}</CodeBlock>
        <CodeBlock>{`{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Kuota pencarian paket Bisnis bulan ini sudah terpakai (2000/2000).",
    "details": null
  },
  "meta": { "requestId": "…", "timestamp": "…" }
}`}</CodeBlock>
        <p className="api-note"><code>meta.page</code> hanya muncul pada endpoint berbentuk daftar. <code>error.details</code> memuat pemetaan nama kolom ke pesan saat validasi gagal, selain itu null. Waktu selalu ISO 8601 UTC, dan metrik yang tidak diketahui bernilai null, bukan nol.</p>
      </article>

      <article className="panel api-doc-panel">
        <h2>Kode error</h2>
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
      </article>

      {groups.map(group => (
        <article className="panel api-doc-panel" key={group.name}>
          <h2>{group.name}</h2>
          <p>{group.description}</p>
          <div className="api-endpoint-list">
            {group.endpoints.map(endpoint => <EndpointCard key={`${endpoint.method} ${endpoint.path}`} endpoint={endpoint} baseUrl={baseUrl} />)}
          </div>
        </article>
      ))}
    </section>
  );
}
