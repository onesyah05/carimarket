/**
 * Pengganti paket `server-only` saat pengujian.
 *
 * Di aplikasi, impor `server-only` memastikan modul tidak ikut ke bundel klien.
 * Vitest berjalan di Node tanpa resolusi khusus Next, jadi impornya dipetakan
 * ke modul kosong ini (lihat vitest.config.ts) agar logika murni tetap dapat
 * diuji tanpa melemahkan batas server di kode produksi.
 */
export {};
