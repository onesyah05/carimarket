"use client";

import { Bot, ShieldCheck, UserCheck } from "lucide-react";
import { useReplyAutomation } from "@/features/replies/lib/use-reply-automation";

export function ReplyModeStep() {
  const { settings, updateSettings } = useReplyAutomation();
  return <div className="onboarding-form"><div className="mode-choice-grid mode-choice-grid--onboarding" role="radiogroup" aria-label="Pilih mode balasan"><button type="button" role="radio" aria-checked={settings.mode === "review"} className={settings.mode === "review" ? "active" : ""} onClick={() => updateSettings({ ...settings, mode: "review" })}><UserCheck /><span><strong>Tinjau dulu</strong><small>Baca dan edit setiap draft sebelum dikirim. Cocok untuk memulai.</small></span></button><button type="button" role="radio" aria-checked={settings.mode === "auto"} className={settings.mode === "auto" ? "active" : ""} onClick={() => updateSettings({ ...settings, mode: "auto" })}><Bot /><span><strong>Balas otomatis</strong><small>Kirim draft yang memenuhi aturan tanpa approval satu per satu.</small></span></button></div>{settings.mode === "auto" && <div className="automation-warning"><ShieldCheck size={18} /><p><strong>Default aman:</strong> minimal relevansi 90%, maksimal 10 balasan per hari, jeda 15 menit, dan draft berisiko tetap ditinjau manual.</p></div>}<a className="button button--primary" href="/dashboard">Simpan dan buka dashboard</a><p className="onboarding-hint">Mode ini dapat diubah kapan saja melalui Pengaturan.</p></div>;
}
