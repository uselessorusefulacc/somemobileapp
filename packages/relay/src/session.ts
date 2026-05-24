import type { ServerWebSocket } from "bun";
import type { Session, RelayMessage, PeerRole } from "./types";

const MAX_QUEUE_SIZE = 50;
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 100; // messages per second per session

export class SessionManager {
  private sessions = new Map<string, Session>();
  private rateLimiters = new Map<string, { count: number; resetAt: number }>();
  private cleanupInterval: Timer | null = null;

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
          console.log(`[SessionManager] Cleaned up expired session: ${sessionId}`);
        }
      }
    }, 60_000);
  }

  getOrCreate(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
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
    const session = this.getOrCreate(sessionId);

    if (role === "phone" && session.phone) {
      console.warn(`[SessionManager] Session ${sessionId} already has a phone connected`);
      return false;
    }
    if (role === "daemon" && session.daemon) {
      console.warn(`[SessionManager] Session ${sessionId} already has a daemon connected`);
      return false;
    }

    if (role === "phone") session.phone = socket;
    if (role === "daemon") session.daemon = socket;

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
      console.log(`[SessionManager] Flushing ${session.messageQueue.length} queued messages to phone for session ${sessionId}`);
      for (const msg of session.messageQueue) {
        this.sendToSocket(socket, msg);
      }
      session.messageQueue = [];
    }

    return true;
  }

  removePeer(sessionId: string, role: PeerRole) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

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

    // Rate limiting
    if (!this.checkRateLimit(sessionId)) {
      console.warn(`[SessionManager] Rate limit exceeded for session ${sessionId}`);
      return false;
    }

    session.lastActivity = Date.now();

    const toRole = fromRole === "phone" ? "daemon" : "phone";
    const target = toRole === "phone" ? session.phone : session.daemon;

    if (target && target.readyState === WebSocket.OPEN) {
      this.sendToSocket(target, message);
      return true;
    }

    // Queue messages from daemon to phone
    if (fromRole === "daemon" && toRole === "phone") {
      session.messageQueue.push(message);
      if (session.messageQueue.length > MAX_QUEUE_SIZE) {
        session.messageQueue.shift();
      }
    }

    return false;
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

  private sendToSocket(socket: ServerWebSocket<unknown>, message: RelayMessage) {
    try {
      socket.send(JSON.stringify(message));
    } catch (e) {
      console.error("[SessionManager] Failed to send message:", e);
    }
  }

  getStats() {
    return {
      sessions: this.sessions.size,
      phones: [...this.sessions.values()].filter((s) => s.phone).length,
      daemons: [...this.sessions.values()].filter((s) => s.daemon).length,
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    this.rateLimiters.clear();
  }
}
