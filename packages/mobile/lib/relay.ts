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
  error: (err: Event) => void;
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
  private messageQueue: string[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(sessionId: string, relayUrl: string = "ws://localhost:8080") {
    super();
    this.sessionId = sessionId;
    this.relayUrl = relayUrl;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.closed) return;
    const url = `${this.relayUrl}?session=${this.sessionId}&role=phone`;
    console.log(`[RelayClient] Connecting: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[RelayClient] Connected");
      this.reconnectAttempt = 0;
      this.emit("connected");
      this.flushQueue();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "pong") return;
        this.emit(msg.type as keyof RelayEventMap, msg.payload);
      } catch (e) {
        console.warn("[RelayClient] Malformed message:", event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log("[RelayClient] Disconnected:", event.reason);
      this.emit("disconnected", event.reason);
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("[RelayClient] WebSocket error:", error);
      this.emit("error", error);
    };
  }

  send(type: string, payload: unknown) {
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.messageQueue.push(msg);
      if (this.messageQueue.length > 100) this.messageQueue.shift();
    }
  }

  sendCommand(action: CommandPayload["action"], params?: Record<string, unknown>) {
    this.send("command", { action, params });
  }

  sendInject(text: string) {
    this.send("command", { action: "inject", params: { text } });
  }

  sendKill() {
    this.send("command", { action: "kill", params: {} });
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
  }

  private flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.ws?.send(msg);
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
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
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
