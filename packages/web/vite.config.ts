import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "path";
import runableAnalyticsPlugin from "./vite/plugins/runable-analytics-plugin";
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
	// #8: do NOT assign env to process.env — that leaks all secrets into the client bundle
	// Only expose specific VITE_* prefixed vars (Vite does this automatically)
	const _env = loadEnv(mode, root, "");
	void _env; // loaded for potential SSR use in plugins only

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
