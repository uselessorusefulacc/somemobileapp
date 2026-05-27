#!/usr/bin/env node
import { Command } from "commander";
import { spawn } from "child_process";
import { createRequire } from "module";
import { RelayClient } from "./relay-client.js";
import { installInterceptors } from "./interceptor.js";
import { CommandExecutor } from "./commands.js";
import { detectRunningAgents, detectAgentInfoForCommand, detectModelFromEnv } from "./agent-detector.js";
import { parseLine } from "./stdout-parser.js";
import { calculateCost, normalizeModel } from "./pricing.js";
import { redactSensitive } from "./logger.js";
import { validateConfig, loadConfig } from "./config.js";
import type { AgentInfo, TokenUsage } from "./types.js";
// @ts-ignore
import qrcode from "qrcode-terminal";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

let activeRelay: RelayClient | null = null;

// ── CLI ─────────────────────────────────────────────────────────────────────
const program = new Command();

program
  .name("mafa")
  .description("mafa — stream any AI coding agent to your phone")
  .version(version);

// ── `run` subcommand — wrap an agent command ───────────────────────────────
program
  .command("run")
  .description("Wrap and monitor an agent command (recommended)")
  .requiredOption("-s, --session <uuid>", "Session ID from the mobile app")
  .option("-r, --relay <url>", "Relay WebSocket URL", loadConfig().relayUrl)
  .option("-v, --verbose", "Verbose logging", false)
  .option("--restart", "Auto-restart child on non-zero exit (default off)", false)
  .allowUnknownOption(true)
  .argument("[cmd...]", "Agent command to run, e.g: -- claude 'fix my tests'")
  .action(async (args: string[], opts: { session: string; relay: string; verbose: boolean; restart: boolean }) => {
    validateConfig();
    validateSession(opts.session);

    // args after -- are the agent command
    const agentArgs = args.length ? args : getRemainingArgs();
    if (!agentArgs.length) {
      console.error("[Daemon] No command provided. Usage: mafa run -s <uuid> -- claude 'fix me'");
      process.exit(1);
    }

    const relay = new RelayClient(opts.session, opts.relay, opts.verbose);
    activeRelay = relay;
    const executor = new CommandExecutor(relay);

    relay.onCommand((cmd) => executor.execute(cmd));
    relay.connect();

    // Detect agent type from the command
    const agentInfo = detectAgentInfoForCommand(agentArgs[0]);
    const envModel = detectModelFromEnv();
    if (envModel) agentInfo.model = envModel;

    console.log(`[Daemon] Agent: ${agentInfo.type} | Model: ${agentInfo.model}`);
    relay.sendAgentInfo(agentInfo);
    relay.sendStatus("starting", `Launching: ${agentArgs[0]}`);

    const [bin, ...rest] = agentArgs;
    const child = spawn(bin, rest, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
      shell: process.platform === "win32",
    });

    child.on("error", (err) => {
      console.error(`[Daemon] Failed to spawn ${bin}: ${err.message}`);
      relay.sendStatus("error", `Failed to spawn ${bin}: ${err.message}`);
      setTimeout(() => {
        relay.close();
        process.exit(1);
      }, 1000);
    });

    executor.setChild(child);

    let detectedModel = agentInfo.model;

    const agentParserType = (agentInfo.type === "claude" || agentInfo.type === "aider" || agentInfo.type === "codex" || agentInfo.type === "gemini" || agentInfo.type === "opencode" || agentInfo.type === "auto") ? agentInfo.type : "auto";

    const handleLine = (line: string) => {
      process.stdout.write(line + "\n");
      relay.sendOutput(line);

      const parsed = parseLine(line, agentParserType);
      if (parsed.model) {
        detectedModel = parsed.model;
        relay.sendAgentInfo({ ...agentInfo, model: detectedModel });
      }
      if (parsed.toolCall) {
        relay.sendToolCall(parsed.toolCall);
        if (opts.verbose) console.error(`[Daemon] tool: ${parsed.toolCall.tool}(${redactSensitive(parsed.toolCall.input ?? "")})`);
      }
      if (parsed.tokenUsage) {
        const cost = calculateCost(detectedModel, parsed.tokenUsage);
        const usage: TokenUsage = {
          ...parsed.tokenUsage,
          totalTokens: parsed.tokenUsage.inputTokens + parsed.tokenUsage.outputTokens,
          model: detectedModel,
          costUsd: cost,
          timestamp: Date.now(),
        };
        relay.sendTokens(usage);
      }
    };

    const MAX_BUF_SIZE = 100_000;
    let stdoutBuf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      if (stdoutBuf.length > MAX_BUF_SIZE) {
        console.warn(`[Daemon] stdout buffer exceeded ${MAX_BUF_SIZE}B, discarding oldest data`);
        stdoutBuf = stdoutBuf.slice(-Math.floor(MAX_BUF_SIZE / 2));
      }
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      lines.forEach(handleLine);
    });
    child.stdout?.on("error", (err) => {
      console.error("[Daemon] stdout error:", err);
    });

    let stderrBuf = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.length > MAX_BUF_SIZE) {
        console.warn(`[Daemon] stderr buffer exceeded ${MAX_BUF_SIZE}B, discarding oldest data`);
        stderrBuf = stderrBuf.slice(-Math.floor(MAX_BUF_SIZE / 2));
      }
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      lines.forEach((l) => {
        process.stderr.write(l + "\n");
        relay.sendOutput("[stderr] " + l);
      });
    });
    child.stderr?.on("error", (err) => {
      console.error("[Daemon] stderr error:", err);
    });

    const stdinPipe = (d: Buffer) => {
      if (child.stdin?.writable) {
        child.stdin.write(d);
      }
    };
    process.stdin.on("data", stdinPipe);

    child.on("exit", (code, signal) => {
      process.stdin.off("data", stdinPipe);
      const reason = signal !== null ? `signal ${signal}` : `code ${code}`;
      relay.sendStatus("exited", `Agent exited with ${reason}`);
      console.log(`[Daemon] Agent exited with ${reason}`);

      if (opts.restart && code !== 0) {
        console.log(`[Daemon] --restart is set, relaunching ${bin}...`);
        const newChild = spawn(bin, rest, {
          stdio: ["pipe", "pipe", "pipe"],
          env: process.env,
          shell: process.platform === "win32",
        });
        executor.setChild(newChild);
        // reattach handlers...  (simplified: for full restart, user should re-run)
        console.log("[Daemon] Restart logic requires re-attaching handlers; consider using process manager.");
      }

      setTimeout(() => {
        relay.close();
        process.exit(code ?? 0);
      }, 1000);
    });

    setupShutdown(relay);
  });

// ── `pair` subcommand — create session and print QR ───────────────────────
program
  .command("pair")
  .description("Create a session and print a QR code to scan with your phone")
  .option("-r, --relay <url>", "Relay WebSocket URL", loadConfig().relayUrl)
  .option("-a, --api <url>", "API base URL", loadConfig().apiUrl)
  .action(async (opts: { relay: string; api: string }) => {
    console.log("\n  Connecting to MAFA...\n");
    let res: Response;
    try {
      res = await fetch(`${opts.api}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Daemon Session", agentType: "assistant" }),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`  [Pair] Failed to reach API at ${opts.api}: ${message}`);
      process.exit(1);
    }
    const data = await res.json() as Record<string, unknown>;
    const session = data?.session as Record<string, unknown> | undefined;
    const id = typeof session?.id === "string" ? session.id : undefined;
    if (!id) {
      console.error("  [Pair] Failed to create session:", JSON.stringify(data));
      process.exit(1);
    }
    const wsUrl = `${opts.relay}?session=${id}&role=daemon`;
    console.log("  Scan this QR code with the MAFA app:\n");
    qrcode.generate(wsUrl, { small: true });
    console.log(`  Session: ${id}`);
    console.log(`  WS URL:  ${redactSensitive(wsUrl)}\n`);
    console.log("  Open MAFA on your phone → Connect tab → Scan QR\n");

    // Connect as daemon so we get peer_connected / peer_disconnected
    const relay = new RelayClient(id, opts.relay, false);
    relay.connect();

    let phoneConnected = false;

    relay.onCommand(() => {}); // Required to arm the message handler

    process.on("SIGINT", () => {
      console.log("\n  [Pair] Shutting down relay...");
      relay.close();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      relay.close();
      process.exit(0);
    });

    console.log(`  Now run your agent with:\n`);
    console.log(`    mafa run -s ${id} -- claude "your task here"\n`);

    keepAlive();
  });

// ── `attach` subcommand — scan running processes ──────────────────────────
program
  .command("attach")
  .description("Auto-detect a running agent process and monitor it")
  .requiredOption("-s, --session <uuid>", "Session ID from the mobile app")
  .option("-r, --relay <url>", "Relay WebSocket URL", loadConfig().relayUrl)
  .option("-v, --verbose", "Verbose logging", false)
  .action((opts: { session: string; relay: string; verbose: boolean }) => {
    validateSession(opts.session);

    const relay = new RelayClient(opts.session, opts.relay, opts.verbose);
    const executor = new CommandExecutor(relay);
    relay.onCommand((cmd) => executor.execute(cmd));

    // Install fetch interceptor in this process
    installInterceptors(relay, opts.verbose);
    relay.connect();

    console.log("[Daemon] Scanning for running agents...");
    const found = detectRunningAgents();
    if (found.length === 0) {
      console.log("[Daemon] No running agents detected. Waiting for fetch() calls...");
      relay.sendStatus("idle", "Waiting — no agent detected yet. Is your agent running in this process?");
    } else {
      found.forEach((a: AgentInfo) => {
        console.log(`[Daemon] Found: ${a.type} (PID ${a.pid}) model=${a.model}`);
        relay.sendAgentInfo(a);
      });
      relay.sendStatus("working", `Monitoring ${found.length} agent(s)`);
    }

    setupShutdown(relay);
  });

// ── `detect` subcommand — just scan and print ────────────────────────────
program
  .command("detect")
  .description("Detect running agents without connecting to relay")
  .action(() => {
    const found = detectRunningAgents();
    if (found.length === 0) {
      console.log("No running agents detected.");
    } else {
      console.log("Detected agents:");
      found.forEach((a: AgentInfo) => {
        console.log(`  ${a.type} | PID: ${a.pid ?? "?"} | model: ${a.model}${a.configSource ? ` | config: ${a.configSource}` : ""}`);
      });
    }
    process.exit(0);
  });

// ── Helpers ────────────────────────────────────────────────────────────────

function keepAlive(): void {
  setInterval(() => {}, 60_000).unref();
}

function validateSession(id: string) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (id === "undefined" || id === "null" || !UUID_RE.test(id)) {
    console.error(`[Daemon] Invalid session ID: "${id}"`);
    console.error("[Daemon] Copy the session ID from the MAFA app.");
    process.exit(1);
  }
}

function getRemainingArgs(): string[] {
  // Everything after -- in process.argv
  const sep = process.argv.indexOf("--");
  return sep !== -1 ? process.argv.slice(sep + 1) : [];
}

// Global error handlers
process.on("unhandledRejection", (reason) => {
  console.error("[Daemon] Unhandled rejection:", reason);
  activeRelay?.send("status", { agentStatus: "error" });
  activeRelay?.close();
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[Daemon] Uncaught exception:", err);
  activeRelay?.send("status", { agentStatus: "error" });
  activeRelay?.close();
  process.exit(1);
});

function setupShutdown(relay: RelayClient) {
  let shuttingDown = false;
  const handler = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[Daemon] Shutting down...");
    relay.close();
    process.exit(0);
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);

  keepAlive();
  console.log("[Daemon] Running. Press Ctrl+C to stop.");
}

program.parse();
