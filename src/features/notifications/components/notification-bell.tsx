"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

type Feed = { items: Notification[]; unread: number };

type Props = {
  /** Tautan dan salinan cadangan untuk workspace internal yang belum memakai notifikasi per akun. */
  fallbackHref: string;
  fallbackLabel: string;
  fallbackCopy: string;
  /** Hanya workspace pengguna yang menerima notifikasi tersimpan. */
  enabled: boolean;
};

async function fetchFeed(): Promise<Feed> {
  const response = await fetch("/api/notifications", { cache: "no-store" });
  const payload = await response.json() as { data?: Feed; error?: string };
  if (!response.ok || !payload.data) throw new Error(payload.error ?? "Notifikasi belum dapat dimuat.");
  return payload.data;
}

function relativeTime(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

export function NotificationBell({ fallbackHref, fallbackLabel, fallbackCopy, enabled }: Props) {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<Feed>({ items: [], unread: 0 });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchFeed()
      .then(next => { if (active) { setFeed(next); setError(undefined); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Notifikasi belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || !enabled) return;

    try {
      const latest = await fetchFeed();
      setFeed(latest);
      setError(undefined);
      if (latest.unread === 0) return;
      // Membuka popover berarti notifikasi sudah dilihat.
      const marked = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (marked.ok) setFeed({ items: latest.items.map(item => ({ ...item, read: true })), unread: 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notifikasi belum dapat dimuat.");
    }
  }

  return <div className="notification-wrap">
    <button className="icon-button" aria-label={feed.unread > 0 ? `Buka notifikasi, ${feed.unread} belum dibaca` : "Buka notifikasi"} aria-expanded={open} onClick={() => void toggle()}>
      <Bell size={19} />
      {feed.unread > 0 && <span className="notification-badge">{feed.unread > 9 ? "9+" : feed.unread}</span>}
    </button>
    {open && <div className="notification-popover">
      <strong>Notifikasi</strong>
      {!enabled && <><p>{fallbackCopy}</p><Link href={fallbackHref} onClick={() => setOpen(false)}>{fallbackLabel}</Link></>}
      {enabled && loading && <p>Memuat notifikasi…</p>}
      {enabled && !loading && error && <p role="alert">{error}</p>}
      {enabled && !loading && !error && feed.items.length === 0 && <p>Belum ada notifikasi. Lead baru, status balasan, dan peringatan kuota akan muncul di sini.</p>}
      {enabled && !loading && !error && feed.items.length > 0 && <ul className="notification-list">
        {feed.items.map(item => <li key={item.id} className={item.read ? "" : "notification-list__unread"}>
          <strong>{item.title}</strong>
          <span>{item.body}</span>
          <small>{relativeTime(item.createdAt)}</small>
          {item.href && <Link href={item.href} onClick={() => setOpen(false)}>Buka</Link>}
        </li>)}
      </ul>}
    </div>}
  </div>;
}
