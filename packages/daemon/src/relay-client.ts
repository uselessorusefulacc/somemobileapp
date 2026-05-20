import { WebSocket } from "ws";
import type { TokenUsage, CommandMessage, RelayMessage } from "./types";

export class RelayClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private relayUrl: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private messageQueue: string[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private onCommandCallback: ((cmd: CommandMessage) => void) | null = null;
  private closed = false;

  constructor(sessionId: string, relayUrl: string) {
    this.sessionId = sessionId;
    this.relayUrl = relayUrl;
  }

  connect() {
    if (this.closed) return;
    const url = `${this.relayUrl}?session=${this.sessionId}&role=daemon`;
    console.log(`[Daemon] Connecting to relay: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("[Daemon] Connected to relay");
      this.reconnectAttempt = 0;
      this.flushQueue();
      this.startHeartbeat();
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as RelayMessage;
        if (msg.type === "pong") return;
        if (msg.type === "command" && this.onCommandCallback) {
          this.onCommandCallback(msg.payload as CommandMessage);
        }
        if (msg.type === "peer_connected") {
          console.log("[Daemon] Phone connected");
        }
        if (msg.type === "peer_disconnected") {
          console.log("[Daemon] Phone disconnected");
        }
      } catch {
        console.warn("[Daemon] Malformed message from relay");
      }
    });

    this.ws.on("close", () => {
      console.log("[Daemon] Relay connection closed");
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("[Daemon] WebSocket error:", err.message);
    });
  }

  send(type: string, payload: unknown) {
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.messageQueue.push(msg);
      if (this.messageQueue.length > 100) {
        this.messageQueue.shift();
      }
    }
  }

  sendTokens(usage: TokenUsage) {
    this.send("tokens", usage);
  }

  sendStatus(agentStatus: string, currentTask?: string) {
    this.send("status", { agentStatus, currentTask });
  }

  onCommand(cb: (cmd: CommandMessage) => void) {
    this.onCommandCallback = cb;
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
    console.log(`[Daemon] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);
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

  close() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
  }
}
