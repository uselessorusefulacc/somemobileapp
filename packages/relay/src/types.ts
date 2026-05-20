export interface RelayMessage {
  type: "tokens" | "command" | "status" | "error" | "ping" | "pong" | "peer_connected" | "peer_disconnected";
  payload: unknown;
  timestamp: number;
  id?: string;
}

export interface TokenPayload {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd: number;
  latencyMs?: number;
}

export interface CommandPayload {
  action: "pause" | "resume" | "compact" | "switch_model" | "status";
  params?: Record<string, unknown>;
}

export interface StatusPayload {
  agentStatus: "idle" | "working" | "error" | "exited";
  currentTask?: string;
}

import type { ServerWebSocket } from "bun";

export type PeerRole = "phone" | "daemon";

export interface Session {
  sessionId: string;
  phone: ServerWebSocket<unknown> | null;
  daemon: ServerWebSocket<unknown> | null;
  createdAt: number;
  lastActivity: number;
  messageQueue: RelayMessage[];
}
