import type { ServerWebSocket } from "bun";
import type { Session, RelayMessage, PeerRole } from "./types";
import { truncate } from "./utils";

const MAX_QUEUE_SIZE = 50;
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 100; // messages per second per session
const QUEUE_MESSAGE_TTL_MS = 60_000; // 1 minute TTL for queued messages
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS ?? 1000);
const GLOBAL_RATE_LIMIT = 1000;
const MAX_BUFFERED_AMOUNT = 1024 * 1024;
const CLEANUP_INTERVAL_MS = Number(process.env.CLEANUP_INTERVAL_MS ?? 30_000);

export class SessionManager {
  private sessions = new Map<string, Session>();
  private rateLimiters = new Map<string, { count: number; resetAt: number }>();
  private globalRateLimit = { count: 0, resetAt: 0 };
  private messagesForwarded = 0;
  private messagesDropped = 0;
  private queueOverflows = 0;
  private rateLimitHits = 0;
  private cleanupInterval: Timer | null = null;
  private socketTimestamps = new Map<ServerWebSocket<unknown>, number>();

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions) {
        const bothDisconnected = !session.phone && !session.daemon;
        const expired = now - session.lastActivity > SESSION_TTL_MS;
        if (bothDisconnected && expired) {
          this.sessions.delete(sessionId);
          this.rateLimiters.delete(sessionId);
          console.log(`[SessionManager] Cleaned up expired session: ${truncate(sessionId, 12)}`);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  getOrCreate(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      if (this.sessions.size >= MAX_SESSIONS) {
        throw new Error(`[SessionManager] Maximum session limit (${MAX_SESSIONS}) reached`);
      }
      session = {
        sessionId,
        phone: null,
        daemon: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageQueue: [],
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  registerPeer(sessionId: string, role: PeerRole, socket: ServerWebSocket<unknown>): boolean {
    let session: Session;
    try {
      session = this.getOrCreate(sessionId);
    } catch (e) {
      this.sendToSocket(socket, { type: "error", payload: { message: (e as Error).message }, timestamp: Date.now() });
      try { socket.close(1013, "session limit reached"); } catch {}
      return false;
    }

    // Replace stale connections instead of rejecting
    if (role === "phone" && session.phone) {
      const oldSocket = session.phone;
      session.phone = socket;
      this.socketTimestamps.delete(oldSocket);
      try { oldSocket.close(1008, "replaced by new connection"); } catch (e) { console.warn('[SessionManager] close failed:', e); }
    } else if (role === "daemon" && session.daemon) {
      const oldSocket = session.daemon;
      session.daemon = socket;
      this.socketTimestamps.delete(oldSocket);
      try { oldSocket.close(1008, "replaced by new connection"); } catch (e) { console.warn('[SessionManager] close failed:', e); }
    } else {
      if (role === "phone") session.phone = socket;
      if (role === "daemon") session.daemon = socket;
    }

    this.socketTimestamps.set(socket, Date.now());
    session.lastActivity = Date.now();

    // Notify peers
    const otherRole = role === "phone" ? "daemon" : "phone";
    const otherSocket = otherRole === "phone" ? session.phone : session.daemon;
    if (otherSocket) {
      this.sendToSocket(otherSocket, {
        type: "peer_connected",
        payload: { role },
        timestamp: Date.now(),
      });
      this.sendToSocket(socket, {
        type: "peer_connected",
        payload: { role: otherRole },
        timestamp: Date.now(),
      });
    }

    // Flush queued messages to phone when it connects
    if (role === "phone" && session.messageQueue.length > 0) {
      const now = Date.now();
      const freshMessages = session.messageQueue.filter(m => now - m.timestamp < QUEUE_MESSAGE_TTL_MS);
      if (freshMessages.length < session.messageQueue.length) {
        console.log(`[SessionManager] Dropped ${session.messageQueue.length - freshMessages.length} expired queued messages for session ${truncate(sessionId, 12)}`);
      }
      if (freshMessages.length > 0) {
        for (const msg of freshMessages) {
          this.sendToSocket(socket, msg);
        }
      }
      session.messageQueue = [];
    }

    return true;
  }

  removePeer(sessionId: string, role: PeerRole, socket?: ServerWebSocket<unknown>) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Only null the slot if the socket still matches (handles connection replacement)
    if (socket) {
      if (role === "phone" && session.phone !== socket) return;
      if (role === "daemon" && session.daemon !== socket) return;
    }

    const sockToRemove = socket ?? (role === "phone" ? session.phone : session.daemon);
    if (sockToRemove) this.socketTimestamps.delete(sockToRemove);

    if (role === "phone") session.phone = null;
    if (role === "daemon") session.daemon = null;

    const otherRole = role === "phone" ? "daemon" : "phone";
    const otherSocket = otherRole === "phone" ? session.phone : session.daemon;
    if (otherSocket) {
      this.sendToSocket(otherSocket, {
        type: "peer_disconnected",
        payload: { role },
        timestamp: Date.now(),
      });
    }
  }

  forwardMessage(sessionId: string, fromRole: PeerRole, message: RelayMessage): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Global rate limiting
    if (!this.checkGlobalRateLimit()) {
      console.warn(`[SessionManager] Global rate limit exceeded`);
      this.rateLimitHits++;
      return false;
    }

    // Per-session rate limiting
    if (!this.checkRateLimit(sessionId)) {
      console.warn(`[SessionManager] Rate limit exceeded for session ${truncate(sessionId, 12)}`);
      this.rateLimitHits++;
      return false;
    }

    session.lastActivity = Date.now();

    const toRole = fromRole === "phone" ? "daemon" : "phone";
    const target = toRole === "phone" ? session.phone : session.daemon;

    if (target) {
      if (target.readyState === WebSocket.OPEN) {
        const sent = this.sendToSocket(target, message);
        if (sent) { this.messagesForwarded++; return true; }
        // Send failed but socket might still be OPEN (e.g. JSON.stringify error)
      }

      if (target.readyState !== WebSocket.OPEN) {
        this.socketTimestamps.delete(target);
        if (toRole === "phone") {
          session.phone = null;
          if (session.daemon) {
            this.sendToSocket(session.daemon, {
              type: "peer_disconnected",
              payload: { role: "phone" },
              timestamp: Date.now(),
            });
          }
        } else {
          session.daemon = null;
          if (session.phone) {
            this.sendToSocket(session.phone, {
              type: "peer_disconnected",
              payload: { role: "daemon" },
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // Queue messages from daemon to phone
    if (fromRole === "daemon" && toRole === "phone") {
      session.messageQueue.push(message);
      if (session.messageQueue.length > MAX_QUEUE_SIZE) {
        const dropped = session.messageQueue.shift();
        console.warn(`[SessionManager] Message queue overflow for session ${truncate(session.sessionId, 12)}, dropped oldest message`);
        this.queueOverflows++;
      }
    }

    return false;
  }

  private checkGlobalRateLimit(): boolean {
    const now = Date.now();
    if (now > this.globalRateLimit.resetAt) {
      this.globalRateLimit = { count: 1, resetAt: now + 1000 };
      return true;
    }
    if (this.globalRateLimit.count >= GLOBAL_RATE_LIMIT) {
      return false;
    }
    this.globalRateLimit.count++;
    return true;
  }

  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    let limiter = this.rateLimiters.get(sessionId);
    if (!limiter || now > limiter.resetAt) {
      limiter = { count: 1, resetAt: now + 1000 };
      this.rateLimiters.set(sessionId, limiter);
      return true;
    }
    if (limiter.count >= RATE_LIMIT_MAX) {
      return false;
    }
    limiter.count++;
    return true;
  }

  sendToSocket(socket: ServerWebSocket<unknown>, message: RelayMessage): boolean {
    if (typeof socket.getBufferedAmount === "function" && socket.getBufferedAmount() > MAX_BUFFERED_AMOUNT) {
      console.warn("[SessionManager] Socket buffer full, dropping message");
      this.messagesDropped++;
      return false;
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(message);
    } catch (e) {
      console.error("[SessionManager] Failed to serialize message:", e);
      return false;
    }
    try {
      socket.send(serialized);
      return true;
    } catch (e) {
      console.error("[SessionManager] Failed to send message:", e);
      this.messagesDropped++;
      return false;
    }
  }

  updateSocketActivity(socket: ServerWebSocket<unknown>) {
    this.socketTimestamps.set(socket, Date.now());
  }

  forEachSocket(callback: (socket: ServerWebSocket<unknown>, sessionId: string, role: PeerRole) => void) {
    for (const [sessionId, session] of this.sessions) {
      if (session.phone) callback(session.phone, sessionId, "phone");
      if (session.daemon) callback(session.daemon, sessionId, "daemon");
    }
  }

  heartbeat(now: number, maxIdleMs: number) {
    for (const [, session] of this.sessions) {
      for (const role of ["phone", "daemon"] as const) {
        const socket = role === "phone" ? session.phone : session.daemon;
        if (!socket) continue;
        const lastTs = this.socketTimestamps.get(socket) ?? session.lastActivity;
        if (now - lastTs > maxIdleMs) {
          console.log(`[SessionManager] Closing idle ${role} for session ${truncate(session.sessionId, 12)}`);
          try { socket.close(1001, "idle timeout"); } catch (e) { console.warn('[SessionManager] close failed:', e); }
        }
      }
    }
  }

  getStats() {
    let phones = 0;
    let daemons = 0;
    for (const session of this.sessions.values()) {
      if (session.phone) phones++;
      if (session.daemon) daemons++;
    }
    return {
      sessions: this.sessions.size,
      phones,
      daemons,
      messagesForwarded: this.messagesForwarded,
      messagesDropped: this.messagesDropped,
      queueOverflows: this.queueOverflows,
      rateLimitHits: this.rateLimitHits,
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    this.rateLimiters.clear();
    this.socketTimestamps.clear();
  }
}
