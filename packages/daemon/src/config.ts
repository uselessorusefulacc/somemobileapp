import { homedir, platform } from "os";
import { join } from "path";

export function getConfigDir(): string {
  const home = homedir();
  const base = process.env.MAFA_CONFIG_DIR;
  if (base) return base;
  if (platform() === "win32") {
    return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "mafa");
  }
  return join(home, ".config", "mafa");
}

export function getCacheDir(): string {
  return join(getConfigDir(), "cache");
}

export const PRICING_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const PRICING_CACHE_FILE = "pricing-cache.json";

export interface DaemonConfig {
  apiUrl: string;
  relayUrl: string;
}

export function loadConfig(): DaemonConfig {
  return {
    apiUrl: process.env.MAFA_API ?? "http://localhost:4200",
    relayUrl: process.env.MAFA_RELAY ?? "ws://localhost:4200/ws",
  };
}

const WS_URL_RE = /^wss?:\/\/.+/;
const HTTP_URL_RE = /^https?:\/\/.+/;

export function isValidWsUrl(url: string): boolean {
  return WS_URL_RE.test(url);
}

export function isValidHttpUrl(url: string): boolean {
  return HTTP_URL_RE.test(url);
}

export function validateConfig(): void {
  const config = loadConfig();

  if (!isValidWsUrl(config.relayUrl)) {
    console.error(`[Config] Invalid MAFA_RELAY: "${config.relayUrl}" — must be a ws:// or wss:// URL`);
    process.exit(1);
  }

  if (!isValidHttpUrl(config.apiUrl)) {
    console.error(`[Config] Invalid MAFA_API: "${config.apiUrl}" — must be an http:// or https:// URL`);
    process.exit(1);
  }
}
