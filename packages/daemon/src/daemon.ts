#!/usr/bin/env node
import { Command } from "commander";
import { RelayClient } from "./relay-client";
import { installInterceptors } from "./interceptor";
import { CommandExecutor } from "./commands";

const program = new Command();

program
  .name("agentpilot-daemon")
  .description("AgentPilot daemon — intercept LLM calls and stream usage to mobile")
  .version("1.0.0")
  .requiredOption("-s, --session <uuid>", "Session ID (UUID v4) to pair with mobile app")
  .option("-r, --relay <url>", "Relay server URL", "wss://relay.agentpilot.dev")
  .option("-v, --verbose", "Enable verbose logging", false)
  .parse();

const opts = program.opts();
const sessionId: string = opts.session;
const relayUrl: string = opts.relay;
const verbose: boolean = opts.verbose;

// Validate UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(sessionId)) {
  console.error("Error: session must be a valid UUID v4");
  process.exit(1);
}

if (verbose) {
  console.log(`[Daemon] Starting with session: ${sessionId}`);
  console.log(`[Daemon] Relay: ${relayUrl}`);
}

const relay = new RelayClient(sessionId, relayUrl);
const executor = new CommandExecutor(relay);

relay.onCommand((cmd) => {
  executor.execute(cmd);
});

// Install fetch interceptor before connecting
installInterceptors(relay);

// Connect to relay
relay.connect();

// Send initial status
relay.sendStatus("idle", "Waiting for agent to start making API calls");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Daemon] Shutting down...");
  relay.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  relay.close();
  process.exit(0);
});

// Keep alive
setInterval(() => {
  // noop — process stays alive for WebSocket + interceptor
}, 60_000);

console.log("[Daemon] Running. Press Ctrl+C to stop.");
