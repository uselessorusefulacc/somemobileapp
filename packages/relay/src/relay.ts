import { SessionManager } from "./session";
import type { PeerRole, RelayMessage } from "./types";

const PORT = Number(process.env.PORT ?? 8080);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sessionManager = new SessionManager();

const server = Bun.serve<{ sessionId: string; role: PeerRole }>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // HTTP health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", ...sessionManager.getStats() }), {
        headers: { "Content-Type": "application/json" },
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
    open(ws) {
      const { sessionId, role } = ws.data;
      console.log(`[Relay] ${role} connecting to session ${sessionId}`);

      const registered = sessionManager.registerPeer(sessionId, role, ws);
      if (!registered) {
        ws.close(1008, "session full");
        return;
      }
    },

    message(ws, message: string | Buffer) {
      const { sessionId, role } = ws.data;

      if (typeof message !== "string") {
        console.warn("[Relay] Binary messages not supported");
        return;
      }

      let parsed: RelayMessage;
      try {
        parsed = JSON.parse(message);
      } catch {
        console.warn("[Relay] Malformed JSON message:", message.slice(0, 200));
        return;
      }

      // Handle ping/pong at relay level
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", payload: {}, timestamp: Date.now() }));
        return;
      }

      sessionManager.forwardMessage(sessionId, role, parsed);
    },

    close(ws, code: number, reason: string) {
      const { sessionId, role } = ws.data;
      console.log(`[Relay] ${role} disconnected from ${sessionId} (code ${code}: ${reason})`);
      sessionManager.removePeer(sessionId, role);
    },

    // @ts-expect-error Bun WebSocketHandler types omit error handler
    error(_ws: unknown, error: Error) {
      console.error("[Relay] WebSocket error:", error);
    },
  },
});

console.log(`[Relay] Server running at ws://localhost:${PORT}`);
console.log(`[Relay] Health check: http://localhost:${PORT}/health`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[Relay] Shutting down...");
  sessionManager.destroy();
  server.stop(true);
  process.exit(0);
});
