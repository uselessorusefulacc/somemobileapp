import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "path";
import runableAnalyticsPlugin from "./vite/plugins/runable-analytics-plugin";
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
	// #8: do NOT assign ALL env to process.env — that leaks secrets into the client bundle.
	// Only inject server-side vars needed by the Hono SSR handler (never VITE_ vars here).
	const _env = loadEnv(mode, root, "");
	// Inject DB credentials so the Hono dev server (ssrLoadModule) can reach Turso.
	if (_env.DATABASE_URL) process.env.DATABASE_URL = _env.DATABASE_URL;
	if (_env.DATABASE_AUTH_TOKEN) process.env.DATABASE_AUTH_TOKEN = _env.DATABASE_AUTH_TOKEN;

	return {
		plugins: [honoDevPlugin(), react(), runableAnalyticsPlugin(), tailwind()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src/web"),
			},
		},
		server: {
			port: 4200,
			// #129: allowedHosts: true allows any host — use specific list or omit for localhost-only
			allowedHosts: ["localhost", "127.0.0.1"],
			hmr: { overlay: false },
			cors: false,
		},
	};
});
