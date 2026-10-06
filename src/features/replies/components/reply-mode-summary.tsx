"use client";

import Link from "next/link";
import { Bot, ShieldCheck, UserCheck } from "lucide-react";
import { useReplyAutomation } from "@/features/replies/lib/use-reply-automation";

export function ReplyModeSummary() {
  const { settings } = useReplyAutomation();
  const automatic = settings.mode === "auto";
  const Icon = automatic ? Bot : UserCheck;
  return <section className={`panel reply-mode-summary reply-mode-summary--${settings.mode}`}><div className="reply-mode-summary__icon"><Icon /></div><div><span>Mode balasan</span><h2>{automatic ? "Balas otomatis" : "Tinjau dulu"}</h2><p>{automatic ? `Kriteria: relevansi minimal ${settings.minimumScore}%, maksimal ${settings.dailyLimit} balasan per hari, dengan jeda ${settings.delayMinutes} menit.` : "Setiap draft menunggu Anda baca, edit, dan setujui."}</p>{automatic && settings.pauseOnRisk && <small><ShieldCheck size={14} /> Draft berisiko tetap masuk antrean tinjauan.</small>}<Link href="/dashboard/pengaturan">Atur mode balasan</Link></div></section>;
}
