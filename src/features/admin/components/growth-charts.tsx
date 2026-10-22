"use client";

import { useId, useState } from "react";
import { Table2 } from "lucide-react";
import type { GrowthPoint, GrowthSeries } from "@/server/admin/growth";

/**
 * Grafik pertumbuhan Superadmin.
 *
 * Dua grafik, bukan satu dengan dua sumbu: akun baru dihitung dalam satuan
 * orang dan pemakaian dalam satuan permintaan, jadi menumpuknya pada dua skala
 * akan membuat gambar yang dapat dibaca menjadi apa pun. Pencarian dan balasan
 * boleh satu grafik karena satuannya sama — keduanya permintaan ke Threads.
 *
 * Digambar sebagai SVG sebaris tanpa pustaka grafik: bentuknya sederhana, dan
 * satu dependensi lagi di halaman internal tidak sebanding dengan biayanya.
 *
 * Warnanya hasil validasi kontras dan keterbacaan buta warna terhadap
 * permukaan masing-masing mode; identitas seri tidak pernah hanya warna —
 * selalu ada legenda, label langsung, dan tampilan tabel.
 */

const WIDTH = 760;
const HEIGHT = 240;
const PAD = { top: 18, right: 20, bottom: 32, left: 48 };

const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** Sumbu yang berhenti di angka bulat supaya garis bantu dapat dibaca. */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function ticks(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, index) => Math.round((max / count) * index));
}

function formatCount(value: number) {
  return value.toLocaleString("id-ID");
}

type Hover = { index: number; x: number; y: number } | null;

export function GrowthCharts({ series }: { series: GrowthSeries }) {
  const [showTable, setShowTable] = useState(false);
  const { points, totals } = series;

  return (
    <section className="panel chart-panel">
      <header className="panel-head">
        <div>
          <h2>Pertumbuhan 12 bulan terakhir</h2>
          <p>
            {formatCount(totals.newUsers)} akun pelanggan baru, {formatCount(totals.searches)} pencarian, dan{" "}
            {formatCount(totals.replies)} balasan terkirim dalam rentang ini. Bulan dihitung menurut UTC.
          </p>
        </div>
        <button
          className="button button--ghost"
          type="button"
          onClick={() => setShowTable(current => !current)}
          aria-expanded={showTable}
        >
          <Table2 size={15} /> {showTable ? "Sembunyikan tabel" : "Lihat sebagai tabel"}
        </button>
      </header>

      <UsersChart points={points} />
      <UsageChart points={points} />

      {showTable && (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <caption>Angka yang sama dalam bentuk tabel.</caption>
            <thead>
              <tr>
                <th scope="col">Bulan</th>
                <th scope="col">Akun baru</th>
                <th scope="col">Pencarian</th>
                <th scope="col">Balasan</th>
              </tr>
            </thead>
            <tbody>
              {points.map(point => (
                <tr key={point.period}>
                  <th scope="row">{point.label}</th>
                  <td>{formatCount(point.newUsers)}</td>
                  <td>{formatCount(point.searches)}</td>
                  <td>{formatCount(point.replies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Akun baru per bulan: besaran per periode diskret, jadi batang. */
function UsersChart({ points }: { points: GrowthPoint[] }) {
  const [hover, setHover] = useState<Hover>(null);
  const titleId = useId();
  const max = niceMax(Math.max(...points.map(point => point.newUsers), 1));
  // Celah 2px antar batang dijaga dengan menyisakan lebar, bukan dengan stroke.
  const slot = PLOT_W / points.length;
  const barWidth = Math.max(6, Math.min(34, slot - 10));

  return (
    <figure className="chart-figure">
      <figcaption id={titleId}>Akun pelanggan baru per bulan</figcaption>
      <div className="chart-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={titleId} className="chart-svg">
          <Grid max={max} />
          {points.map((point, index) => {
            const height = (point.newUsers / max) * PLOT_H;
            const x = PAD.left + slot * index + (slot - barWidth) / 2;
            const y = PAD.top + PLOT_H - height;
            return (
              <g key={point.period}>
                {/* Sasaran hover sengaja lebih lebar dari batangnya. */}
                <rect
                  x={PAD.left + slot * index}
                  y={PAD.top}
                  width={slot}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setHover({ index, x: x + barWidth / 2, y })}
                  onMouseLeave={() => setHover(null)}
                />
                {point.newUsers > 0 && (
                  <rect
                    className="chart-bar"
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={4}
                    opacity={hover && hover.index !== index ? 0.45 : 1}
                  />
                )}
              </g>
            );
          })}
          <XAxis points={points} slot={slot} />
        </svg>
        {hover && (
          <Tooltip x={hover.x} y={hover.y}>
            <strong>{points[hover.index].label}</strong>
            <span>{formatCount(points[hover.index].newUsers)} akun baru</span>
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

const USAGE_SERIES = [
  { key: "searches" as const, label: "Pencarian", className: "is-searches" },
  { key: "replies" as const, label: "Balasan terkirim", className: "is-replies" },
];

/** Pencarian dan balasan: satuan sama, jadi satu grafik dan satu sumbu. */
function UsageChart({ points }: { points: GrowthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();
  const max = niceMax(Math.max(...points.flatMap(point => [point.searches, point.replies]), 1));
  const step = points.length > 1 ? PLOT_W / (points.length - 1) : 0;

  const pointAt = (index: number, value: number) => ({
    x: PAD.left + step * index,
    y: PAD.top + PLOT_H - (value / max) * PLOT_H,
  });

  return (
    <figure className="chart-figure">
      <figcaption id={titleId}>Permintaan ke Threads per bulan</figcaption>

      {/* Legenda selalu ada untuk dua seri; label langsung menyusul di ujung garis. */}
      <ul className="chart-legend">
        {USAGE_SERIES.map(entry => (
          <li key={entry.key}><span className={`chart-swatch ${entry.className}`} aria-hidden="true" /> {entry.label}</li>
        ))}
      </ul>

      <div className="chart-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={titleId} className="chart-svg">
          <Grid max={max} />

          {USAGE_SERIES.map(entry => (
            <polyline
              key={entry.key}
              className={`chart-line ${entry.className}`}
              points={points.map((point, index) => {
                const position = pointAt(index, point[entry.key]);
                return `${position.x},${position.y}`;
              }).join(" ")}
            />
          ))}

          {/* Penanda hanya pada titik yang sedang disorot, supaya garisnya tetap tipis. */}
          {hover !== null && USAGE_SERIES.map(entry => {
            const position = pointAt(hover, points[hover][entry.key]);
            return (
              <circle
                key={entry.key}
                className={`chart-marker ${entry.className}`}
                cx={position.x}
                cy={position.y}
                r={5}
              />
            );
          })}

          {hover !== null && (
            <line
              className="chart-crosshair"
              x1={PAD.left + step * hover}
              x2={PAD.left + step * hover}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
            />
          )}

          {points.map((point, index) => (
            <rect
              key={point.period}
              x={PAD.left + step * index - step / 2}
              y={PAD.top}
              width={Math.max(step, 12)}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          <XAxis points={points} slot={step} centered={false} />
        </svg>

        {hover !== null && (
          <Tooltip x={PAD.left + step * hover} y={PAD.top}>
            <strong>{points[hover].label}</strong>
            <span><i className="chart-swatch is-searches" aria-hidden="true" /> {formatCount(points[hover].searches)} pencarian</span>
            <span><i className="chart-swatch is-replies" aria-hidden="true" /> {formatCount(points[hover].replies)} balasan</span>
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

function Grid({ max }: { max: number }) {
  return (
    <g className="chart-grid" aria-hidden="true">
      {ticks(max).map(tick => {
        const y = PAD.top + PLOT_H - (tick / max) * PLOT_H;
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} />
            <text x={PAD.left - 10} y={y + 4} textAnchor="end">{formatCount(tick)}</text>
          </g>
        );
      })}
    </g>
  );
}

function XAxis({ points, slot, centered = true }: { points: GrowthPoint[]; slot: number; centered?: boolean }) {
  // Pada layar sempit label bulan saling menimpa, jadi hanya sebagian ditulis.
  const stride = points.length > 8 ? 2 : 1;
  return (
    <g className="chart-xaxis" aria-hidden="true">
      {points.map((point, index) => index % stride === 0 && (
        <text
          key={point.period}
          x={PAD.left + slot * index + (centered ? slot / 2 : 0)}
          y={HEIGHT - 10}
          textAnchor="middle"
        >
          {point.label}
        </text>
      ))}
    </g>
  );
}

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="chart-tooltip"
      role="status"
      style={{ left: `${(x / WIDTH) * 100}%`, top: `${(y / HEIGHT) * 100}%` }}
    >
      {children}
    </div>
  );
}
