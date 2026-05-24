/**
 * lib/format.ts — shared formatting utilities
 * BUG-27 FIX: single source of truth for formatCost, formatTokens, getStatusColor
 */
import { colors } from "./theme";

/** Format a USD cost value into a human-readable string */
export function formatCost(c: number): string {
  if (c === 0) return "$0.00";
  if (c < 0.0001) return `$${(c * 1_000_000).toFixed(1)}μ`;
  if (c < 0.001) return `$${(c * 1_000).toFixed(2)}m`;
  if (c < 1) return `$${c.toFixed(4)}`;
  if (c < 100) return `$${c.toFixed(2)}`;
  return `$${c.toFixed(0)}`;
}

/** Format a raw token count into K/M notation */
export function formatTokens(t: number): string {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(2)}M`;
  if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`;
  return String(t);
}

/** Map an agent/session status string to a theme colour */
export function getStatusColor(s: string): string {
  switch (s) {
    case "active":
    case "working":
      return colors.success;
    case "paused":
    case "starting":
      return colors.warning;
    case "error":
    case "exited":
      return colors.danger;
    default:
      return colors.textTertiary;
  }
}

/** Returns a cost-level colour — green → yellow → red thresholds */
export function costColor(usd: number, thresholds: [number, number] = [0.1, 1]): string {
  if (usd > thresholds[1]) return colors.danger;
  if (usd > thresholds[0]) return colors.warning;
  return colors.text;
}
