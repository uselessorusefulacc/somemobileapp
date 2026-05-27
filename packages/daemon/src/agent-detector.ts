import { readFileSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import type { AgentInfo } from "./types";

function parseYamlModel(raw: string): string | null {
  const match = raw.match(/model\s*:\s*["']?([^\s"'\n]+)["']?/);
  return match?.[1] ?? null;
}

// ── Known agent signatures ─────────────────────────────────────────────────

interface AgentSignature {
  type: string;
  /** Process names to look for in ps output */
  processNames: string[];
  /** Config files that reveal model */
  configPaths: (cwd: string) => string[];
  /** Parse config to extract model */
  parseConfig?: (raw: string, filePath: string) => string | null;
  /** Default model if nothing found */
  defaultModel: string;
}

const AGENT_SIGNATURES: AgentSignature[] = [
  {
    type: "claude",
    processNames: ["claude", "claude-code", "@anthropic/claude-code"],
    configPaths: (cwd) => [
      join(cwd, ".claude", "settings.json"),
      join(cwd, ".claude", "settings.local.json"),
      join(homedir(), ".claude", "settings.json"),
      join(homedir(), ".claude.json"),
    ],
    parseConfig: (raw) => {
      try {
        const cfg = JSON.parse(raw);
        return cfg.model || cfg.defaultModel || null;
      } catch {
        return null;
      }
    },
    defaultModel: "claude-sonnet-4-5",
  },
  {
    type: "codex",
    processNames: ["codex", "openai-codex", "@openai/codex"],
    configPaths: (cwd) => [
      join(cwd, "codex.yaml"),
      join(cwd, "codex.yml"),
      join(homedir(), ".codex", "config.yaml"),
      join(homedir(), ".codex", "config.yml"),
    ],
    parseConfig: parseYamlModel,
    defaultModel: "o3",
  },
  {
    type: "aider",
    processNames: ["aider"],
    configPaths: (cwd) => [
      join(cwd, ".aider.conf.yml"),
      join(cwd, ".aider.conf.yaml"),
      join(homedir(), ".aider.conf.yml"),
      join(homedir(), ".aider.conf.yaml"),
    ],
    parseConfig: parseYamlModel,
    defaultModel: "claude-sonnet-4-5",
  },
  {
    type: "gemini",
    processNames: ["gemini", "gemini-cli", "@google/gemini-cli"],
    configPaths: (cwd) => [
      join(cwd, ".gemini", "settings.json"),
      join(homedir(), ".gemini", "settings.json"),
    ],
    parseConfig: (raw) => {
      try {
        const cfg = JSON.parse(raw);
        return cfg.model || cfg.defaultModel || null;
      } catch {
        return null;
      }
    },
    defaultModel: "gemini-2-5-pro",
  },
  {
    type: "opencode",
    processNames: ["opencode"],
    configPaths: (cwd) => [
      join(cwd, "opencode.json"),
      join(cwd, "opencode.toml"),
      join(homedir(), ".config", "opencode", "config.json"),
    ],
    parseConfig: (raw) => {
      try {
        const cfg = JSON.parse(raw);
        return cfg.model || null;
      } catch {
        // try toml
        const match = raw.match(/model\s*=\s*["']?([^\s"'\n]+)["']?/);
        return match?.[1] ?? null;
      }
    },
    defaultModel: "claude-sonnet-4-5",
  },
  {
    type: "copilot",
    processNames: ["gh", "github-copilot", "copilot"],
    configPaths: (cwd) => [
      join(homedir(), ".config", "gh", "config.yml"),
    ],
    defaultModel: "gpt-4o",
  },
  {
    type: "cline",
    processNames: ["cline", "roo"],
    configPaths: (cwd) => [
      join(homedir(), ".vscode", "extensions"),
    ],
    defaultModel: "claude-sonnet-4-5",
  },
  {
    type: "hermes",
    processNames: ["hermes", "hermes-agent"],
    configPaths: () => [],
    defaultModel: "claude-sonnet-4-5",
  },
  {
    type: "openclaw",
    processNames: ["openclaw"],
    configPaths: () => [],
    defaultModel: "claude-sonnet-4-5",
  },
];

// ── Config file readers ────────────────────────────────────────────────────

function readFirstExisting(paths: string[]): { content: string; path: string } | null {
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        return { content: readFileSync(p, "utf8"), path: p };
      } catch {
        continue;
      }
    }
  }
  return null;
}

function detectModelFromConfig(sig: AgentSignature, cwd: string): { model: string; configSource: string } {
  const paths = sig.configPaths(cwd);
  const file = readFirstExisting(paths);
  if (!file || !sig.parseConfig) return { model: sig.defaultModel, configSource: "" };

  const model = sig.parseConfig(file.content, file.path);
  if (model) return { model, configSource: file.path };
  return { model: sig.defaultModel, configSource: file.path };
}

// ── Process scanner ────────────────────────────────────────────────────────

interface RunningProcess {
  pid: number;
  name: string;
  cmd: string;
}

function scanProcesses(): RunningProcess[] {
  try {
    const isWin = process.platform === "win32";
    if (isWin) {
      const out = execSync("tasklist /fo csv /nh 2>nul", { encoding: "utf8", timeout: 3000 });
      return out.split("\n").flatMap((line) => {
        const parts = line.split(",").map((s) => s.replace(/"/g, "").trim());
        if (parts.length < 2) return [];
        const pid = parseInt(parts[1]);
        if (isNaN(pid)) return [];
        return [{ pid, name: parts[0].toLowerCase(), cmd: parts[0] }];
      });
    } else {
      const out = execSync("ps -eo pid,comm,args 2>/dev/null || ps -eo pid,comm 2>/dev/null", {
        encoding: "utf8",
        timeout: 3000,
      });
      return out.split("\n").slice(1).flatMap((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) return [];
        const pid = parseInt(parts[0]);
        if (isNaN(pid)) return [];
        const cmd = parts.slice(1).join(" ").toLowerCase();
        return [{ pid, name: parts[1].toLowerCase(), cmd }];
      });
    }
  } catch {
    return [];
  }
}

// ── Main detector ─────────────────────────────────────────────────────────

export function detectRunningAgents(cwd = process.cwd()): AgentInfo[] {
  const procs = scanProcesses();
  const found: AgentInfo[] = [];

  for (const sig of AGENT_SIGNATURES) {
    for (const proc of procs) {
      const matches = sig.processNames.some(
        (name) => {
          const lower = name.toLowerCase();
          return proc.name === lower || proc.name.startsWith(lower + " ") || proc.cmd.startsWith(lower + " ") ||
                 proc.cmd === lower || proc.cmd.includes("/" + lower);
        }
      );
      if (matches) {
        const { model, configSource } = detectModelFromConfig(sig, cwd);
        found.push({ type: sig.type, model, pid: proc.pid, configSource });
      }
    }
  }

  return found;
}

export function detectAgentFromCommandLine(cmd: string): AgentSignature | null {
  const lower = cmd.toLowerCase();
  for (const sig of AGENT_SIGNATURES) {
    if (sig.processNames.some((name) => lower.includes(name))) {
      return sig;
    }
  }
  return null;
}

export function detectAgentInfoForCommand(cmd: string, cwd = process.cwd()): AgentInfo {
  const sig = detectAgentFromCommandLine(cmd);
  if (!sig) return { type: "unknown", model: "unknown" };
  const { model, configSource } = detectModelFromConfig(sig, cwd);
  return { type: sig.type, model, configSource };
}

export function detectModelFromEnv(): string | null {
  // Many agents read ANTHROPIC_MODEL, OPENAI_DEFAULT_MODEL, etc.
  return (
    process.env.ANTHROPIC_MODEL ||
    process.env.CLAUDE_MODEL ||
    process.env.OPENAI_DEFAULT_MODEL ||
    process.env.GEMINI_MODEL ||
    process.env.AIDER_MODEL ||
    null
  );
}
