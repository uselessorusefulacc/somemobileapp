import { SessionManager } from "./session";
import type { PeerRole, RelayMessage } from "./types";
import type { ServerWebSocket, WebSocketHandler } from "bun";
import { truncate } from "./utils";

declare module "bun" {
  interface WebSocketHandler<T> {
    error?(ws: ServerWebSocket<T>, error: Error): void | Promise<void>;
  }
}

let PORT = parseInt(process.env.PORT || "8082", 10);
if (isNaN(PORT) || PORT < 1 || PORT > 65535) PORT = 8082;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB max message payload
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_IDLE_MS = 30_000;

// Allowed origins for WebSocket connections (comma-separated, empty = allow all)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
if (!process.env.ALLOWED_ORIGINS) {
  console.warn("[Relay] ALLOWED_ORIGINS not set — no CSRF protection for WebSocket upgrades");
}

const sessionManager = new SessionManager();

const server = Bun.serve<{ sessionId: string; role: PeerRole }>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // CORS preflight for health endpoint
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // HTTP health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", ...sessionManager.getStats() }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const sessionId = url.searchParams.get("session");
      const role = url.searchParams.get("role") as PeerRole | null;

      if (!sessionId || !role) {
        return new Response("missing sessionId or role", { status: 400 });
      }
      if (!UUID_REGEX.test(sessionId)) {
        return new Response("invalid sessionId format (expected UUID v4)", { status: 400 });
      }
      if (role !== "phone" && role !== "daemon") {
        return new Response("role must be 'phone' or 'daemon'", { status: 400 });
      }

      // Origin check when origins are configured (defense-in-depth)
      if (ALLOWED_ORIGINS.length > 0) {
        const origin = req.headers.get("origin");
        if (!origin || !ALLOWED_ORIGINS.some(a => origin.startsWith(a))) {
          console.warn(`[Relay] Rejected WebSocket upgrade from origin: ${origin}`);
          return new Response("origin not allowed", { status: 403 });
        }
      }

      const success = server.upgrade(req, {
        data: { sessionId, role },
      });
      if (!success) {
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return undefined as unknown as Response; // upgraded
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket<{ sessionId: string; role: PeerRole }>) {
      const { sessionId, role } = ws.data;
      console.log(`[Relay] ${role} connecting to session ${truncate(sessionId, 12)}`);

      if (!sessionManager.registerPeer(sessionId, role, ws)) {
        return;
      }
      sessionManager.updateSocketActivity(ws);
    },

    message(ws: ServerWebSocket<{ sessionId: string; role: PeerRole }>, message: string | Buffer) {
      const { sessionId, role } = ws.data;

      if (typeof message !== "string") {
        console.warn("[Relay] Binary messages not supported");
        ws.send(JSON.stringify({ type: "error", payload: { message: "Binary messages not supported" }, timestamp: Date.now() }));
        return;
      }

      if (message.length > MAX_MESSAGE_SIZE) {
        console.warn(`[Relay] Message too large (${message.length} bytes), closing connection`);
        ws.close(1009, "message too large");
        return;
      }

      let parsed: RelayMessage;
      try {
        parsed = JSON.parse(message);
      } catch {
        console.warn("[Relay] Malformed JSON message:", message.slice(0, 200));
        ws.send(JSON.stringify({ type: "error", payload: { message: "Malformed message" }, timestamp: Date.now() }));
        return;
      }

      sessionManager.updateSocketActivity(ws);

      // Handle ping/pong at relay level
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", payload: {}, timestamp: Date.now() }));
        return;
      }

      const forwarded = sessionManager.forwardMessage(sessionId, role, parsed);
      if (!forwarded) {
        console.warn(`[Relay] ${role} message not delivered for session ${truncate(sessionId, 12)}`);
      }
    },

    close(ws: ServerWebSocket<{ sessionId: string; role: PeerRole }>, code: number, reason: string, hadError?: boolean) {
      const { sessionId, role } = ws.data;
      console.log(`[Relay] ${role} disconnected from ${truncate(sessionId, 12)} (code ${code}: ${reason}${hadError ? ", hadError" : ""})`);
      sessionManager.removePeer(sessionId, role, ws);
    },

    error(ws: ServerWebSocket<{ sessionId: string; role: PeerRole }>, error: Error) {
      console.error("[Relay] WebSocket error:", error);
    },
  },
});

console.log(`[Relay] Server running at ws://localhost:${PORT}`);
console.log(`[Relay] Health check: http://localhost:${PORT}/health`);

// Server-side heartbeat: ping all connections with staggered delays, close stale ones
let heartbeatTimer: Timer | null = null;

function scheduleHeartbeat() {
  const entries: Array<{ ws: ServerWebSocket<unknown>; sessionId: string; role: PeerRole }> = [];
  sessionManager.forEachSocket((ws, sessionId, role) => entries.push({ ws, sessionId, role }));

  entries.forEach(({ ws }, i) => {
    const delay = Math.min(i * 50, 500);
    setTimeout(() => {
      try { ws.send(JSON.stringify({ type: "ping", payload: {}, timestamp: Date.now() })); } catch {}
    }, delay);
  });

  const maxPingDelay = Math.min(entries.length * 50, 500) + 100;
  setTimeout(() => {
    sessionManager.heartbeat(Date.now(), MAX_IDLE_MS);
  }, maxPingDelay);

  heartbeatTimer = setTimeout(scheduleHeartbeat, HEARTBEAT_INTERVAL_MS);
}

heartbeatTimer = setTimeout(scheduleHeartbeat, HEARTBEAT_INTERVAL_MS);

// Global error handlers
process.on("unhandledRejection", (reason) => {
  console.error("[Relay] Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Relay] Uncaught exception:", err);
});

// Graceful shutdown
function shutdown() {
  console.log("[Relay] Shutting down...");
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  // Close all connections gracefully before stopping
  sessionManager.forEachSocket((ws) => {
    try { ws.close(1001, "server shutting down"); } catch {}
  });
  sessionManager.destroy();
  server.stop(true);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

