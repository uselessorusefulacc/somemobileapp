export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  latencyMs?: number;
  timestamp: number;
}

export interface CommandMessage {
  action: "pause" | "resume" | "compact" | "switch_model" | "status";
  params?: Record<string, unknown>;
}

export interface RelayMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}
