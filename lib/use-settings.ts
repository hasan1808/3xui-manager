"use client";
import { useState, useEffect } from "react";

interface Settings {
  theme: string;
  dashboardRefreshInterval: number;
  autoBackup: boolean;
  autoBackupInterval: number;
  toastDuration: number;
  panelTimeout: number;
  panelRetryAttempts: number;
  compactSidebar: boolean;
}

const DEFAULTS: Settings = {
  theme: "dark",
  dashboardRefreshInterval: 30,
  autoBackup: false,
  autoBackupInterval: 24,
  toastDuration: 3,
  panelTimeout: 10,
  panelRetryAttempts: 3,
  compactSidebar: false,
};

let cachedSettings: Settings | null = null;
let pendingPromise: Promise<Settings> | null = null;

async function fetchSettings(): Promise<Settings> {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const data = await res.json();
      cachedSettings = { ...DEFAULTS, ...data };
      return cachedSettings as Settings;
    }
  } catch {}
  return DEFAULTS;
}

export function getCachedSettings(): Settings | null {
  return cachedSettings;
}

export function loadSettings(): Promise<Settings> {
  if (cachedSettings) return Promise.resolve(cachedSettings);
  if (!pendingPromise) pendingPromise = fetchSettings();
  return pendingPromise;
}

export function updateCachedSettings(updates: Partial<Settings>) {
  if (cachedSettings) cachedSettings = { ...cachedSettings, ...updates };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(cachedSettings || DEFAULTS);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    if (cachedSettings) return;
    loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}
