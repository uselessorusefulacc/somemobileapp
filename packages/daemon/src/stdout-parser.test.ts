import { describe, test, expect } from "bun:test";
import { parseLine } from "./stdout-parser";

describe("stdout-parser", () => {
  // ── Claude ──────────────────────────────────────────────────────────
  test("Claude tool call", () => {
    const r = parseLine("✓ Read(src/index.ts)", "claude");
    expect(r.toolCall?.tool).toBe("Read");
    expect(r.toolCall?.input).toBe("src/index.ts");
  });

  test("Claude token line", () => {
    const r = parseLine("> 12400 input tokens and 800 output tokens", "claude");
    expect(r.tokenUsage?.inputTokens).toBe(12400);
    expect(r.tokenUsage?.outputTokens).toBe(800);
  });

  // ── JSON / OpenAI ────────────────────────────────────────────────────
  test("JSON token usage (Anthropic API format)", () => {
    const line = `{"input_tokens":8192,"output_tokens":512,"cache_read_input_tokens":1024}`;
    const r = parseLine(line, "auto");
    expect(r.tokenUsage?.inputTokens).toBe(8192);
    expect(r.tokenUsage?.outputTokens).toBe(512);
    expect(r.tokenUsage?.cacheReadTokens).toBe(1024);
  });

  test("JSON tool_use", () => {
    const line = `{"type":"tool_use","id":"toolu_01","name":"bash","input":{"command":"ls"}}`;
    const r = parseLine(line, "auto");
    expect(r.toolCall?.tool).toBe("bash");
  });

  test("OAI prompt/completion tokens", () => {
    const line = `{"prompt_tokens":2048,"completion_tokens":256,"total_tokens":2304}`;
    const r = parseLine(line, "auto");
    expect(r.tokenUsage?.inputTokens).toBe(2048);
    expect(r.tokenUsage?.outputTokens).toBe(256);
  });

  // ── Gemini ───────────────────────────────────────────────────────────
  test("Gemini tool call", () => {
    const r = parseLine("Calling tool: run_code", "gemini");
    expect(r.toolCall?.tool).toBe("run_code");
  });

  test("Gemini model line", () => {
    const r = parseLine("Using gemini-2.5-pro for this query", "gemini");
    expect(r.model).toBeTruthy();
  });

  // ── Empty / noise ────────────────────────────────────────────────────
  test("Empty line returns empty object", () => {
    const r = parseLine("", "auto");
    expect(r.model).toBeUndefined();
    expect(r.tokenUsage).toBeUndefined();
  });

  test("Noise line returns empty object", () => {
    const r = parseLine("Some random log output with nothing useful", "auto");
    expect(r.model).toBeUndefined();
    expect(r.toolCall).toBeUndefined();
  });
});
