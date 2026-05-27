import { getDesktopAPI, type ElectronAPI } from "../lib/desktop";

/** Returns the typed Electron API if running in desktop, otherwise null. */
// NOTE: Not a React hook (no useState/useEffect) — named useDesktopAPI to avoid lint violations
export function useDesktopAPI(): ElectronAPI | null {
  return getDesktopAPI();
}
