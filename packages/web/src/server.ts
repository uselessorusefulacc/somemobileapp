import path from "path";
import app from "./api";
// WARN: monorepo-internal relative import — should use workspace protocol
import { SessionManager } from "../../relay/src/session";
// WARN: monorepo-internal relative import — should use workspace protocol
import type { PeerRole } from "../../relay/src/types";

const port = Number(process.env.PORT ?? 3000);
const distDir = `${import.meta.dir}/../dist`;
const indexPath = `${distDir}/index.html`;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sessionManager = new SessionManager();

const server = Bun.serve<{ sessionId: string; role: PeerRole }>({
  port,
  async fetch(request, server) {
    const url = new URL(request.url);

    // ── WebSocket relay on /ws ──────────────────────────────────────────
    if (url.pathname === "/ws" && request.headers.get("upgrade") === "websocket") {
      const sessionId = url.searchParams.get("session");
      const role = url.searchParams.get("role") as PeerRole | null;

      if (!sessionId || !role)
        return new Response("missing session or role", { status: 400 });
      if (!UUID_REGEX.test(sessionId))
        return new Response("invalid sessionId format (expected UUID v4)", { status: 400 });
      if (role !== "phone" && role !== "daemon")
        return new Response("role must be 'phone' or 'daemon'", { status: 400 });

      const success = server.upgrade(request, { data: { sessionId, role } });
      if (!success) return new Response("WebSocket upgrade failed", { status: 500 });
      return undefined as unknown as Response;
    }

    // ── REST API ────────────────────────────────────────────────────────
    if (url.pathname.startsWith("/api")) {
      return app.fetch(request);
    }

    // ── Static files ────────────────────────────────────────────────────
    const filePath = getStaticFilePath(url.pathname);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return new Response(file);
    }

    const index = Bun.file(indexPath);
    if (await index.exists()) {
      return new Response(index, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Build output not found. Run `bun run build` first.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },

  websocket: {
    open(ws) {
      const { sessionId, role } = ws.data;
      console.log(`[Relay] ${role} connecting to session ${sessionId}`);
      const registered = sessionManager.registerPeer(sessionId, role, ws);
      if (!registered) {
        ws.close(1008, "session full");
      }
    },

    message(ws, message: string | Buffer) {
      const { sessionId, role } = ws.data;

      if (typeof message !== "string") {
        console.warn("[Relay] Binary messages not supported");
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(message);
      } catch {
        console.warn("[Relay] Malformed JSON:", message.toString().slice(0, 200));
        return;
      }

      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", payload: {}, timestamp: Date.now() }));
        return;
      }

      sessionManager.forwardMessage(sessionId, role, parsed);
    },

    close(ws, code, reason) {
      const { sessionId, role } = ws.data;
      console.log(`[Relay] ${role} disconnected from ${sessionId} (${code}: ${reason})`);
      sessionManager.removePeer(sessionId, role);
    },
  },
});

console.log(`Web server listening on http://localhost:${server.port}`);
console.log(`Relay WebSocket on ws://localhost:${server.port}/ws`);

// Graceful shutdown
process.on("SIGTERM", () => { console.log("SIGTERM received, shutting down…"); server.stop(); process.exit(0); });
process.on("SIGINT", () => { console.log("SIGINT received, shutting down…"); server.stop(); process.exit(0); });

function getStaticFilePath(pathname: string) {
  const decoded = decodeURIComponent(pathname);
  const cleanPath = path.normalize(decoded).replace(/^[/\\]+/, "");
  if (cleanPath.startsWith("..") || cleanPath.includes(`..${path.sep}`)) {
    return indexPath;
  }
  return cleanPath ? `${distDir}/${cleanPath}` : indexPath;
}
