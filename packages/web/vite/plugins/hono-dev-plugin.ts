import type { Plugin, ViteDevServer } from "vite";
import { Readable } from "node:stream";

export default function honoDevPlugin(): Plugin {
  return {
    name: "hono-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();

        try {
          const request = await toWebRequest(req);
          const app = await loadApp(server);
          const response = await app.fetch(request);

          res.statusCode = response.status;
          response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          // #161: ssrFixStacktrace may not exist in all Vite versions — guard it
          if (typeof (server as any).ssrFixStacktrace === "function") {
            (server as any).ssrFixStacktrace(err as Error);
          }
          console.error("[hono-dev]", err);
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
    },
  };
}

async function loadApp(server: ViteDevServer) {
  const mod = await server.ssrLoadModule("/src/api/index.ts");
  return mod.default;
}

// #160: IncomingMessage is not a ReadableStream — use Readable.toWeb() to convert
async function toWebRequest(req: import("http").IncomingMessage): Promise<Request> {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? Readable.toWeb(req) as ReadableStream : undefined;

  return new Request(url, {
    method: req.method,
    headers,
    body,
    // @ts-expect-error duplex needed for streaming request bodies
    duplex: hasBody ? "half" : undefined,
  });
}
