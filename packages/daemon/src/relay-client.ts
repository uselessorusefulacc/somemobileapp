import { WebSocket } from "ws";
import type { TokenUsage, CommandMessage, RelayMessage, ToolCall, AgentInfo } from "./types";
import { redactSensitive } from "./logger.js";

type MessageHandler = (cmd: CommandMessage) => void;

const MAX_RECONNECT_ATTEMPTS = 20;

export class RelayClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private relayUrl: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private messageQueue: string[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private onCommandCallback: MessageHandler | null = null;
  private closed = false;
  private verbose: boolean;
  private connectionsEstablished = 0;

  constructor(sessionId: string, relayUrl: string, verbose = false) {
    this.sessionId = sessionId;
    this.relayUrl = relayUrl;
    this.verbose = verbose;
  }

  connect() {
    if (this.closed) return;
    const url = `${this.relayUrl}?session=${this.sessionId}&role=daemon`;
    console.log(`[Daemon] Connecting to relay: ${redactSensitive(url)}`);

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.connectionsEstablished++;
      console.log(`[Daemon] ✓ Relay connected (#${this.connectionsEstablished}) — phone can now monitor this session`);
      this.reconnectAttempt = 0;
      this.flushQueue();
      this.startHeartbeat();
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as RelayMessage;
        if (msg.type === "pong") return;
        if (this.verbose) console.log("[Daemon] ← relay:", msg.type, redactSensitive(JSON.stringify(msg.payload)).slice(0, 120));

        if (msg.type === "command" && this.onCommandCallback) {
          this.onCommandCallback(msg.payload as CommandMessage);
        }
        if (msg.type === "peer_connected") {
          console.log("[Daemon] 📱 Phone connected");
        }
        if (msg.type === "peer_disconnected") {
          console.log("[Daemon] 📱 Phone disconnected");
        }
      } catch (err) {
        console.error("[RelayClient] Message parse error:", err);
      }
    });

    this.ws.on("close", () => {
      if (this.verbose) console.log(`[Daemon] Relay disconnected (total connections: ${this.connectionsEstablished})`);
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("[Daemon] WebSocket error:", err instanceof Error ? err.message : String(err));
    });
  }

  send(type: string, payload: unknown) {
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.messageQueue.push(msg);
      if (this.messageQueue.length > 200) {
      console.warn(`[Daemon] Relay message queue full (200), dropping oldest message`);
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

  sendToolCall(toolCall: ToolCall) {
    this.send("tool_call", toolCall);
  }

  sendAgentInfo(info: AgentInfo) {
    this.send("agent_info", info);
  }

  sendOutput(line: string) {
    this.send("output", { line, timestamp: Date.now() });
  }

  onCommand(cb: MessageHandler) {
    this.onCommandCallback = cb;
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private flushQueue() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue[0];
      try {
        ws.send(msg);
        this.messageQueue.shift();
      } catch {
        break; // socket failed mid-flush, keep remaining items
      }
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[Daemon] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      this.closed = true;
      return;
    }
    const baseDelay = Math.min(1000 * 2 ** this.reconnectAttempt, 30000);
    const delay = baseDelay + baseDelay * 0.2 * (Math.random() - 0.5);
    this.reconnectAttempt++;
    console.log(`[Daemon] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send("ping", {});
      } else {
        this.stopHeartbeat();
      }
    }, 20000);
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
    this.flushQueue();
    this.ws?.close();
  }
}
