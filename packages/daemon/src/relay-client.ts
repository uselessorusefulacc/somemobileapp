import { WebSocket } from "ws";
import type { TokenUsage, CommandMessage, RelayMessage, ToolCall, AgentInfo } from "./types";

type MessageHandler = (cmd: CommandMessage) => void;

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

  constructor(sessionId: string, relayUrl: string, verbose = false) {
    this.sessionId = sessionId;
    this.relayUrl = relayUrl;
    this.verbose = verbose;
  }

  connect() {
    if (this.closed) return;
    const url = `${this.relayUrl}?session=${this.sessionId}&role=daemon`;
    console.log(`[Daemon] Connecting to relay: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("[Daemon] ✓ Relay connected — phone can now monitor this session");
      this.reconnectAttempt = 0;
      this.flushQueue();
      this.startHeartbeat();
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as RelayMessage;
        if (msg.type === "pong") return;
        if (this.verbose) console.log("[Daemon] ← relay:", msg.type, JSON.stringify(msg.payload).slice(0, 120));

        if (msg.type === "command" && this.onCommandCallback) {
          this.onCommandCallback(msg.payload as CommandMessage);
        }
        if (msg.type === "peer_connected") {
          console.log("[Daemon] 📱 Phone connected");
        }
        if (msg.type === "peer_disconnected") {
          console.log("[Daemon] 📱 Phone disconnected");
        }
      } catch {
        console.warn("[Daemon] Malformed relay message");
      }
    });

    this.ws.on("close", () => {
      if (this.verbose) console.log("[Daemon] Relay disconnected");
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
      if (this.messageQueue.length > 200) this.messageQueue.shift();
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
    while (this.messageQueue.length > 0) {
      this.ws?.send(this.messageQueue.shift()!);
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const baseDelay = Math.min(1000 * 2 ** this.reconnectAttempt, 30000);
    const delay = baseDelay + baseDelay * 0.2 * (Math.random() - 0.5);
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
    this.ws?.close();
  }
}
