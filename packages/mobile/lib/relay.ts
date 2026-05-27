import { EventEmitter } from "eventemitter3";

export interface TokenPayload {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd: number;
  latencyMs?: number;
  timestamp: number;
}

export interface StatusPayload {
  agentStatus: "idle" | "working" | "paused" | "error" | "exited" | "starting";
  currentTask?: string;
}

export interface ToolCallPayload {
  tool: string;
  input?: string;
  output?: string;
  timestamp: number;
}

export interface AgentInfoPayload {
  type: string;
  model: string;
  pid?: number;
  configSource?: string;
}

export interface OutputPayload {
  line: string;
  timestamp: number;
}

export interface CommandPayload {
  action: "pause" | "resume" | "kill" | "compact" | "switch_model" | "inject" | "status";
  params?: Record<string, unknown>;
}

type RelayEventMap = {
  connected: () => void;
  disconnected: (reason: string) => void;
  error: (err: Error) => void;
  tokens: (payload: TokenPayload) => void;
  status: (payload: StatusPayload) => void;
  tool_call: (payload: ToolCallPayload) => void;
  agent_info: (payload: AgentInfoPayload) => void;
  output: (payload: OutputPayload) => void;
  peer_connected: () => void;
  peer_disconnected: () => void;
};

export class RelayClient extends EventEmitter<RelayEventMap> {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private relayUrl: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  // BUG-03 FIX: store timestamp alongside message for TTL eviction
  private messageQueue: Array<{ msg: string; ts: number }> = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  private heartbeatIntervalMs: number;

  constructor(sessionId: string, relayUrl?: string, heartbeatIntervalMs: number = 15000) {
    super();
    this.sessionId = sessionId;
    this.relayUrl = relayUrl ?? "wss://81ylvadrgdbxmql33216v-preview-4200.runable.site/ws";
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.closed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const url = `${this.relayUrl}?session=${encodeURIComponent(this.sessionId)}&role=phone`;
    console.log(`[RelayClient] Connecting...`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[RelayClient] Connected");
      this.reconnectAttempt = 0;
      this.emit("connected");
      this.flushQueue();
      this.startHeartbeat();
    };

    const VALID_EVENTS = new Set(["tokens", "status", "tool_call", "agent_info", "output", "peer_connected", "peer_disconnected"]);
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "pong") return;
        if (VALID_EVENTS.has(msg.type)) {
          this.emit(msg.type as keyof RelayEventMap, msg.payload);
        } else {
          console.warn("[RelayClient] Unknown message type:", msg.type);
        }
      } catch {
        const err = new Error("Malformed relay message");
        console.warn("[RelayClient] Malformed message:", event.data);
        this.emit("error", err);
      }
    };

    this.ws.onclose = (event) => {
      console.log("[RelayClient] Disconnected:", event.reason);
      this.emit("disconnected", event.reason);
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      const err = new Error("WebSocket connection failed");
      console.error("[RelayClient] WebSocket error:", err.message);
      this.emit("error", err);
    };
  }

  send(type: string, payload: unknown) {
    if (this.closed) return;
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.messageQueue.push({ msg, ts: Date.now() });
      if (this.messageQueue.length > 100) this.messageQueue.shift();
    }
  }

  sendCommand(action: CommandPayload["action"], params?: Record<string, unknown>) {
    this.send("command", { action, params });
  }

  sendInject(text: string) {
    this.sendCommand("inject", { text });
  }

  sendKill() {
    this.sendCommand("kill");
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
  }

  private flushQueue() {
    // BUG-03 FIX: discard messages older than 30s — prevents stale "kill" commands
    const cutoff = Date.now() - 30_000;
    while (this.messageQueue.length > 0) {
      const { msg, ts } = this.messageQueue.shift()!;
      if (ts > cutoff) {
        this.ws?.send(msg);
      } else {
        console.warn("[RelayClient] Discarding stale queued message (>30s old)");
      }
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const baseDelay = Math.min(1000 * 2 ** this.reconnectAttempt, 30000);
    const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
    const delay = Math.max(1000, baseDelay + jitter);
    this.reconnectAttempt++;
    console.log(`[RelayClient] Reconnecting in ${Math.round(delay)}ms`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send("ping", {});
      } else {
        this.stopHeartbeat();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
