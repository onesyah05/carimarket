"use client";

import { useEffect, useState } from "react";

export type ReplyMode = "review" | "auto";

export type ReplyAutomationSettings = {
  mode: ReplyMode;
  minimumScore: number;
  dailyLimit: number;
  delayMinutes: number;
  pauseOnRisk: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

const storageKey = "carimarket-reply-automation";

export const defaultReplyAutomation: ReplyAutomationSettings = {
  mode: "review",
  minimumScore: 90,
  dailyLimit: 10,
  delayMinutes: 15,
  pauseOnRisk: true,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

export function useReplyAutomation() {
  const [settings, setSettings] = useState(defaultReplyAutomation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    let fallback = defaultReplyAutomation;
    if (stored) {
      try {
        fallback = { ...defaultReplyAutomation, ...JSON.parse(stored) as Partial<ReplyAutomationSettings> };
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    let active = true;
    fetch("/api/settings/reply-automation", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as { data?: ReplyAutomationSettings | null };
        if (!response.ok) throw new Error();
        const next = payload.data ?? fallback;
        if (active) setSettings(next);
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      })
      .catch(() => { if (active) setSettings(fallback); });
    return () => { active = false; };
  }, []);

  function updateSettings(next: ReplyAutomationSettings) {
    setSettings(next);
    setSaving(true);
    setError(undefined);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("carimarket-reply-mode", { detail: next }));
    void fetch("/api/settings/reply-automation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).then(async response => {
      if (response.ok) return;
      const payload = await response.json() as { error?: string };
      throw new Error(payload.error ?? "Pengaturan belum dapat disimpan.");
    }).catch(cause => {
      setError(cause instanceof Error ? cause.message : "Pengaturan belum dapat disimpan.");
    }).finally(() => setSaving(false));
  }

  return { settings, updateSettings, saving, error };
}
