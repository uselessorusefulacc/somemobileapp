import type { ToolCall } from "./types";
import { normalizeModel } from "./pricing";

function safeParseInt(v: string | undefined, fallback: number = 0): number {
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

// ── Tool call patterns per agent ───────────────────────────────────────────

interface ParsedLine {
  model?: string;
  toolCall?: ToolCall;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

// Claude Code output patterns
// ✓ Read(file.ts)   Write(file.ts)   Bash(ls)   Tool call styles
const CLAUDE_TOOL_RE = /[✓✗⏎→]\s*(Read|Write|Bash|Edit|MultiEdit|WebFetch|WebSearch|TodoRead|TodoWrite|Glob|Grep|LS|Task|Computer|MCP\w+)\s*\(([^)]{0,500})\)/;
const CLAUDE_MODEL_RE = /model[:\s]+([a-z0-9._-]+)/i;
const CLAUDE_TOKENS_RE = /^[> ]*(\d+)\s+input\s+tokens.*?(\d+)\s+output\s+tokens/im;
const CLAUDE_COST_RE = /\$([0-9]+\.[0-9]+)\s*\(/;

// Codex patterns
const CODEX_TOOL_RE = /\[(function_call|tool_call)\]\s*(\w+)/i;
const CODEX_MODEL_RE = /using model[:\s]+([a-z0-9._-]+)/i;

// Aider patterns
const AIDER_MODEL_RE = /Model:\s+([a-z0-9._/-]+)/i;
const AIDER_TOKENS_RE = /Tokens:\s+(\d+)\s+sent.*?(\d+)\s+received/i;
const AIDER_TOOL_RE = /(Applied edit|Created|Deleted|Renamed)\s+([^\n]+)/;

// Gemini CLI patterns
const GEMINI_MODEL_RE = /\b(gemini-[\d]+\.[\d]+(?:-[a-z]+)*)\b/i;
const GEMINI_TOOL_RE = /Calling tool[:\s]+(\w+)/i;

// OpenCode patterns
const OPENCODE_TOOL_RE = /tool[:\s]+(\w+)\s*\(/i;

// Generic JSON tool call (many agents log JSON)
const JSON_TOOL_RE = /"type"\s*:\s*"tool_use".*?"name"\s*:\s*"([^"]+)"/;
const JSON_MODEL_RE = /"model"\s*:\s*"([^"]+)"/;
const JSON_INPUT_RE = /"input_tokens"\s*:\s*(\d+)/;
const JSON_OUTPUT_RE = /"output_tokens"\s*:\s*(\d+)/;
const JSON_CACHE_READ_RE = /"cache_read_input_tokens"\s*:\s*(\d+)/;
const JSON_CACHE_WRITE_RE = /"cache_creation_input_tokens"\s*:\s*(\d+)/;

// OAI style
const OAI_PROMPT_RE = /"prompt_tokens"\s*:\s*(\d+)/;
const OAI_COMPLETION_RE = /"completion_tokens"\s*:\s*(\d+)/;

// ── Per-agent line parsers ─────────────────────────────────────────────────

function parseClaude(line: string): ParsedLine {
  const result: ParsedLine = {};

  const toolMatch = line.match(CLAUDE_TOOL_RE);
  if (toolMatch) {
    result.toolCall = { tool: toolMatch[1], input: toolMatch[2], timestamp: Date.now() };
  }

  const modelMatch = line.match(CLAUDE_MODEL_RE);
  if (modelMatch) result.model = normalizeModel(modelMatch[1]);

  const tokensMatch = line.match(CLAUDE_TOKENS_RE);
  if (tokensMatch) {
    result.tokenUsage = {
      inputTokens: safeParseInt(tokensMatch[1]),
      outputTokens: safeParseInt(tokensMatch[2]),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }

  return result;
}

function parseAider(line: string): ParsedLine {
  const result: ParsedLine = {};

  const modelMatch = line.match(AIDER_MODEL_RE);
  if (modelMatch) result.model = normalizeModel(modelMatch[1]);

  const toolMatch = line.match(AIDER_TOOL_RE);
  if (toolMatch) {
    result.toolCall = { tool: toolMatch[1], input: toolMatch[2].trim(), timestamp: Date.now() };
  }

  const tokensMatch = line.match(AIDER_TOKENS_RE);
  if (tokensMatch) {
    result.tokenUsage = {
      inputTokens: safeParseInt(tokensMatch[1]),
      outputTokens: safeParseInt(tokensMatch[2]),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }

  return result;
}

function parseCodex(line: string): ParsedLine {
  const result: ParsedLine = {};
  const modelMatch = line.match(CODEX_MODEL_RE);
  if (modelMatch) result.model = normalizeModel(modelMatch[1]);
  const toolMatch = line.match(CODEX_TOOL_RE);
  if (toolMatch) {
    result.toolCall = { tool: toolMatch[2], timestamp: Date.now() };
  }
  return result;
}

function parseGemini(line: string): ParsedLine {
  const result: ParsedLine = {};
  const modelMatch = line.match(GEMINI_MODEL_RE);
  if (modelMatch) result.model = normalizeModel("gemini-" + modelMatch[1]);
  const toolMatch = line.match(GEMINI_TOOL_RE);
  if (toolMatch) result.toolCall = { tool: toolMatch[1], timestamp: Date.now() };
  return result;
}

function parseOpenCode(line: string): ParsedLine {
  const result: ParsedLine = {};
  const toolMatch = line.match(OPENCODE_TOOL_RE);
  if (toolMatch) {
    result.toolCall = { tool: toolMatch[1], timestamp: Date.now() };
  }
  return result;
}

function parseGenericJson(line: string): ParsedLine {
  const result: ParsedLine = {};

  const modelMatch = line.match(JSON_MODEL_RE);
  if (modelMatch) result.model = normalizeModel(modelMatch[1]);

  const toolMatch = line.match(JSON_TOOL_RE);
  if (toolMatch) result.toolCall = { tool: toolMatch[1], timestamp: Date.now() };

  const inputMatch = line.match(JSON_INPUT_RE);
  const outputMatch = line.match(JSON_OUTPUT_RE);
  if (inputMatch && outputMatch) {
    result.tokenUsage = {
      inputTokens: safeParseInt(inputMatch[1]),
      outputTokens: safeParseInt(outputMatch[1]),
      cacheReadTokens: safeParseInt(line.match(JSON_CACHE_READ_RE)?.[1]),
      cacheWriteTokens: safeParseInt(line.match(JSON_CACHE_WRITE_RE)?.[1]),
    };
  }

  const promptMatch = line.match(OAI_PROMPT_RE);
  const completionMatch = line.match(OAI_COMPLETION_RE);
  if (promptMatch && completionMatch && !result.tokenUsage) {
    result.tokenUsage = {
      inputTokens: safeParseInt(promptMatch[1]),
      outputTokens: safeParseInt(completionMatch[1]),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }

  return result;
}

// ── Public API ─────────────────────────────────────────────────────────────

export type AgentParserType = "claude" | "codex" | "gemini" | "opencode" | "auto";

export function parseLine(line: string, agentType: AgentParserType = "auto"): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) return {};

  // Always try JSON first (catches most structured output)
  const generic = parseGenericJson(trimmed);

  // In auto mode, stop after first parser that finds tokenUsage
  // to prevent data corruption from overlapping regexes
  let specific: ParsedLine = {};
  let tokenFound = false;
  if (agentType === "claude" || agentType === "auto") { const r = parseClaude(trimmed); if (r.tokenUsage) tokenFound = true; specific = { ...specific, ...r }; }

    if (agentType === "codex" || (agentType === "auto" && !tokenFound)) specific = { ...specific, ...parseCodex(trimmed) };
  if (agentType === "gemini" || (agentType === "auto" && !tokenFound)) specific = { ...specific, ...parseGemini(trimmed) };
  if (agentType === "opencode" || (agentType === "auto" && !tokenFound)) specific = { ...specific, ...parseOpenCode(trimmed) };

  return {
    model: specific.model || generic.model,
    toolCall: specific.toolCall || generic.toolCall,
    tokenUsage: specific.tokenUsage || generic.tokenUsage,
  };
}
