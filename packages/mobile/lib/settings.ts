import { Platform } from "react-native";

// AsyncStorage is available via @react-native-async-storage/async-storage in Expo
let AsyncStorage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> } | null = null;
try {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch {
  // fallback: in-memory only (settings lost on app restart)
}

export interface AppSettings {
  relayUrl: string;
  defaultAgentType: string;
  defaultModel: string;
  autoRefresh: boolean;
  autoRefreshMs: number;
  budgetDailyLimit: number | null;
  budgetMonthlyLimit: number | null;
  budgetAlertPct: number;
  colorTheme: "dark" | "light";
  heartbeatIntervalMs: number;
  maxLiveLines: number;
}

const DEFAULTS: AppSettings = {
  relayUrl: "ws://localhost:8082",
  defaultAgentType: "claude",
  defaultModel: "claude-sonnet-4-5",
  autoRefresh: true,
  autoRefreshMs: 15000,
  budgetDailyLimit: null,
  budgetMonthlyLimit: null,
  budgetAlertPct: 80,
  colorTheme: "dark",
  heartbeatIntervalMs: 15000,
  maxLiveLines: 200,
};

let cachedSettings: AppSettings | null = null;

function getStorageKey(): string {
  return "@agentpilot/settings";
}

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!AsyncStorage) return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (!AsyncStorage) return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // fail silently
    }
  },
};

export function clearSettingsCache(): void {
  cachedSettings = null;
}

export async function loadSettings(): Promise<AppSettings> {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = await storage.getItem(getStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSettings = { ...DEFAULTS, ...parsed };
      return cachedSettings!;
    }
  } catch { /* use defaults */ }
  cachedSettings = { ...DEFAULTS };
  return cachedSettings!;
}

export function getDefaults(): AppSettings {
  return { ...DEFAULTS };
}

export async function saveSettings(update: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings();
  const next = { ...current, ...update };
  cachedSettings = next;
  try {
    await storage.setItem(getStorageKey(), JSON.stringify(next));
  } catch { /* fail silently */ }
  return next;
}

export function getRelayUrl(settings?: AppSettings): string {
  if (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_RELAY_URL) {
    return process.env.EXPO_PUBLIC_RELAY_URL;
  }
  return settings?.relayUrl ?? DEFAULTS.relayUrl;
}
