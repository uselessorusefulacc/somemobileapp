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

export interface ToolCall {
  tool: string;
  input?: string;
  output?: string;
  timestamp: number;
}

export interface AgentInfo {
  type: string;       // "claude" | "codex" | "gemini" | "opencode" | "copilot" | "cline" | "unknown"
  model: string;
  pid?: number;
  configSource?: string;
}

export interface CommandMessage {
  action:
    | "pause"
    | "resume"
    | "kill"
    | "compact"
    | "switch_model"
    | "inject"
    | "status";
  params?: Record<string, unknown>;
}

export interface RelayMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}
