import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { getCacheDir, PRICING_CACHE_TTL_MS, PRICING_CACHE_FILE } from "./config";

// ── Alias resolution ────────────────────────────────────────────────────────────
export const ALIASES: Record<string, string> = {
  "claude-opus": "claude-opus-4-5",
  "claude-sonnet": "claude-sonnet-4-5",
  "claude-haiku": "claude-haiku-3.5",
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku": "claude-3-5-haiku-20241022",
  "gpt-4.1": "gpt-4.1",
  "gpt4o": "gpt-4o",
  "gpt4": "gpt-4",
  "gemini-pro": "gemini-2-5-pro",
  "gemini-flash": "gemini-2-5-flash",
  "deepseek-chat": "deepseek-v3",
  "deepseek-reasoner": "deepseek-r1",
};

// ── Cursor model pricing overrides ─────────────────────────────────────────────
export const CURSOR_OVERRIDES: Record<string, { inputCostPer1M: number; outputCostPer1M: number; cacheReadCostPer1M: number; cacheWriteCostPer1M: number }> = {
  "gpt-4o-cursor-preview":    { inputCostPer1M: 2.5,  outputCostPer1M: 10,  cacheReadCostPer1M: 1.25, cacheWriteCostPer1M: 0 },
  "claude-sonnet-cursor":     { inputCostPer1M: 3,    outputCostPer1M: 15,  cacheReadCostPer1M: 0.3,  cacheWriteCostPer1M: 3.75 },
  "cursor-fast":              { inputCostPer1M: 0.15, outputCostPer1M: 0.6, cacheReadCostPer1M: 0.075, cacheWriteCostPer1M: 0 },
};

// ── Pricing table (single source of truth) ─────────────────────────────────────
// WARNING: Duplicated in packages/mobile/app/(tabs)/cost.tsx and
// packages/web/src/api/index.ts. When updating this table, update those too.
export const PRICING_TABLE: Record<
  string,
  {
    inputCostPer1M: number;
    outputCostPer1M: number;
    cacheReadCostPer1M: number;
    cacheWriteCostPer1M: number;
  }
> = {
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  "gpt-4.1":                     { inputCostPer1M: 2.00,  outputCostPer1M: 8.00,  cacheReadCostPer1M: 1.00,  cacheWriteCostPer1M: 0 },
  "gpt-4.1-mini":                { inputCostPer1M: 0.40,  outputCostPer1M: 1.60,  cacheReadCostPer1M: 0.20,  cacheWriteCostPer1M: 0 },
  "gpt-4.1-nano":                { inputCostPer1M: 0.10,  outputCostPer1M: 0.40,  cacheReadCostPer1M: 0.05,  cacheWriteCostPer1M: 0 },
  "gpt-4o":                      { inputCostPer1M: 2.50,  outputCostPer1M: 10.00, cacheReadCostPer1M: 1.25,  cacheWriteCostPer1M: 0 },
  "gpt-4o-2024-11-20":           { inputCostPer1M: 2.50,  outputCostPer1M: 10.00, cacheReadCostPer1M: 1.25,  cacheWriteCostPer1M: 0 },
  "gpt-4o-mini":                 { inputCostPer1M: 0.15,  outputCostPer1M: 0.60,  cacheReadCostPer1M: 0.075, cacheWriteCostPer1M: 0 },
  "gpt-4-turbo":                 { inputCostPer1M: 10.00, outputCostPer1M: 30.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "gpt-4":                       { inputCostPer1M: 30.00, outputCostPer1M: 60.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "gpt-3.5-turbo":               { inputCostPer1M: 0.50,  outputCostPer1M: 1.50,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "o1":                          { inputCostPer1M: 15.00, outputCostPer1M: 60.00, cacheReadCostPer1M: 7.50,  cacheWriteCostPer1M: 0 },
  "o1-mini":                     { inputCostPer1M: 3.00,  outputCostPer1M: 12.00, cacheReadCostPer1M: 1.50,  cacheWriteCostPer1M: 0 },
  "o1-pro":                      { inputCostPer1M: 150.00,outputCostPer1M: 600.00,cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "o3":                          { inputCostPer1M: 10.00, outputCostPer1M: 40.00, cacheReadCostPer1M: 2.50,  cacheWriteCostPer1M: 0 },
  "o3-mini":                     { inputCostPer1M: 1.10,  outputCostPer1M: 4.40,  cacheReadCostPer1M: 0.55,  cacheWriteCostPer1M: 0 },
  "o4-mini":                     { inputCostPer1M: 1.10,  outputCostPer1M: 4.40,  cacheReadCostPer1M: 0.275, cacheWriteCostPer1M: 0 },
  // ── Anthropic ───────────────────────────────────────────────────────────────
  "claude-opus-4":               { inputCostPer1M: 15.00, outputCostPer1M: 75.00, cacheReadCostPer1M: 1.50,  cacheWriteCostPer1M: 18.75 },
  "claude-opus-4-5":             { inputCostPer1M: 15.00, outputCostPer1M: 75.00, cacheReadCostPer1M: 1.50,  cacheWriteCostPer1M: 18.75 },
  "claude-sonnet-4":             { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30,  cacheWriteCostPer1M: 3.75 },
  "claude-sonnet-4-5":           { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30,  cacheWriteCostPer1M: 3.75 },
  "claude-sonnet-4-5-20251101":  { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30,  cacheWriteCostPer1M: 3.75 },
  "claude-3-7-sonnet":           { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30,  cacheWriteCostPer1M: 3.75 },
  "claude-3-5-sonnet-20241022":  { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30,  cacheWriteCostPer1M: 3.75 },
  "claude-3-5-haiku-20241022":   { inputCostPer1M: 0.80,  outputCostPer1M: 4.00,  cacheReadCostPer1M: 0.08,  cacheWriteCostPer1M: 1.00 },
  "claude-haiku-4.5":            { inputCostPer1M: 1.00,  outputCostPer1M: 5.00,  cacheReadCostPer1M: 0.10,  cacheWriteCostPer1M: 1.25 },
  "claude-haiku-3.5":            { inputCostPer1M: 0.80,  outputCostPer1M: 4.00,  cacheReadCostPer1M: 0.08,  cacheWriteCostPer1M: 1.00 },
  "claude-haiku-3":              { inputCostPer1M: 0.25,  outputCostPer1M: 1.25,  cacheReadCostPer1M: 0.025, cacheWriteCostPer1M: 0.3125 },
  "claude-3-opus":               { inputCostPer1M: 15.00, outputCostPer1M: 75.00, cacheReadCostPer1M: 1.50,  cacheWriteCostPer1M: 18.75 },
  "claude-3-opus-20240229":      { inputCostPer1M: 15.00, outputCostPer1M: 75.00, cacheReadCostPer1M: 1.50,  cacheWriteCostPer1M: 18.75 },
  // ── Google Gemini ───────────────────────────────────────────────────────────
  "gemini-2-5-pro":              { inputCostPer1M: 1.25,  outputCostPer1M: 10.00, cacheReadCostPer1M: 0.3125, cacheWriteCostPer1M: 4.50 },
  "gemini-2.5-pro":              { inputCostPer1M: 1.25,  outputCostPer1M: 10.00, cacheReadCostPer1M: 0.3125, cacheWriteCostPer1M: 4.50 },
  "gemini-2-5-flash":            { inputCostPer1M: 0.30,  outputCostPer1M: 2.50,  cacheReadCostPer1M: 0.075, cacheWriteCostPer1M: 1.00 },
  "gemini-2.5-flash":            { inputCostPer1M: 0.30,  outputCostPer1M: 2.50,  cacheReadCostPer1M: 0.075, cacheWriteCostPer1M: 1.00 },
  "gemini-2-5-flash-lite":       { inputCostPer1M: 0.10,  outputCostPer1M: 0.40,  cacheReadCostPer1M: 0.025, cacheWriteCostPer1M: 0 },
  "gemini-2.5-flash-lite":       { inputCostPer1M: 0.10,  outputCostPer1M: 0.40,  cacheReadCostPer1M: 0.025, cacheWriteCostPer1M: 0 },
  "gemini-2.0-flash":            { inputCostPer1M: 0.10,  outputCostPer1M: 0.40,  cacheReadCostPer1M: 0.025, cacheWriteCostPer1M: 0 },
  "gemini-2.0-flash-lite":       { inputCostPer1M: 0.075, outputCostPer1M: 0.30,  cacheReadCostPer1M: 0.01875,cacheWriteCostPer1M: 0 },
  "gemini-1.5-pro":              { inputCostPer1M: 1.25,  outputCostPer1M: 5.00,  cacheReadCostPer1M: 0.3125, cacheWriteCostPer1M: 0 },
  "gemini-1.5-flash":            { inputCostPer1M: 0.075, outputCostPer1M: 0.30,  cacheReadCostPer1M: 0.01875,cacheWriteCostPer1M: 0 },
  "gemini-1.0-pro":              { inputCostPer1M: 0.50,  outputCostPer1M: 1.50,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Groq ────────────────────────────────────────────────────────────────────
  "llama-3.3-70b-versatile":     { inputCostPer1M: 0.59,  outputCostPer1M: 0.79,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "llama-3.1-8b-instant":        { inputCostPer1M: 0.05,  outputCostPer1M: 0.08,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "llama-3.1-70b-versatile":     { inputCostPer1M: 0.59,  outputCostPer1M: 0.79,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "llama-3.2-90b-vision":        { inputCostPer1M: 0.90,  outputCostPer1M: 0.90,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "llama-3.2-11b-vision":        { inputCostPer1M: 0.18,  outputCostPer1M: 0.18,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "llama-3.2-3b-preview":        { inputCostPer1M: 0.06,  outputCostPer1M: 0.06,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "llama-3.2-1b-preview":        { inputCostPer1M: 0.04,  outputCostPer1M: 0.04,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "mixtral-8x7b-32768":          { inputCostPer1M: 0.24,  outputCostPer1M: 0.24,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "gemma2-9b-it":                { inputCostPer1M: 0.20,  outputCostPer1M: 0.20,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "deepseek-r1-distill-llama-70b":{ inputCostPer1M: 0.75, outputCostPer1M: 0.99,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── DeepSeek ────────────────────────────────────────────────────────────────
  "deepseek-v3":                 { inputCostPer1M: 0.14,  outputCostPer1M: 0.28,  cacheReadCostPer1M: 0.07,  cacheWriteCostPer1M: 0 },
  "deepseek-v3-0324":            { inputCostPer1M: 0.14,  outputCostPer1M: 0.28,  cacheReadCostPer1M: 0.07,  cacheWriteCostPer1M: 0 },
  "deepseek-r1":                 { inputCostPer1M: 0.55,  outputCostPer1M: 2.19,  cacheReadCostPer1M: 0.275, cacheWriteCostPer1M: 0 },
  "deepseek-r1-0528":            { inputCostPer1M: 0.55,  outputCostPer1M: 2.19,  cacheReadCostPer1M: 0.275, cacheWriteCostPer1M: 0 },
  "deepseek-coder-v2":           { inputCostPer1M: 0.14,  outputCostPer1M: 0.28,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "deepseek-v2.5":               { inputCostPer1M: 0.14,  outputCostPer1M: 0.28,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Mistral ─────────────────────────────────────────────────────────────────
  "mistral-large-latest":        { inputCostPer1M: 2.00,  outputCostPer1M: 6.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "mistral-large-2411":          { inputCostPer1M: 2.00,  outputCostPer1M: 6.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "mistral-medium":              { inputCostPer1M: 0.40,  outputCostPer1M: 1.20,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "mistral-small-latest":        { inputCostPer1M: 0.10,  outputCostPer1M: 0.30,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "mistral-small-2503":          { inputCostPer1M: 0.10,  outputCostPer1M: 0.30,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "codestral-latest":            { inputCostPer1M: 0.20,  outputCostPer1M: 0.60,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "codestral-2501":              { inputCostPer1M: 0.30,  outputCostPer1M: 0.90,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "mistral-7b-instruct":         { inputCostPer1M: 0.025, outputCostPer1M: 0.025, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "mixtral-8x22b":               { inputCostPer1M: 1.20,  outputCostPer1M: 1.20,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "pixtral-large-latest":        { inputCostPer1M: 2.00,  outputCostPer1M: 6.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Perplexity ──────────────────────────────────────────────────────────────
  "sonar-pro":                   { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "sonar":                       { inputCostPer1M: 1.00,  outputCostPer1M: 1.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "sonar-reasoning":             { inputCostPer1M: 1.00,  outputCostPer1M: 5.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "sonar-reasoning-pro":         { inputCostPer1M: 2.00,  outputCostPer1M: 8.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "sonar-deep-research":         { inputCostPer1M: 2.00,  outputCostPer1M: 8.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── OpenRouter ──────────────────────────────────────────────────────────────
  "openrouter/auto":             { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "openrouter/anthropic/claude-3.5-sonnet": { inputCostPer1M: 3.00, outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30, cacheWriteCostPer1M: 3.75 },
  "openrouter/openai/gpt-4o":    { inputCostPer1M: 2.50,  outputCostPer1M: 10.00, cacheReadCostPer1M: 1.25,  cacheWriteCostPer1M: 0 },
  "openrouter/google/gemini-2.5-pro": { inputCostPer1M: 1.25, outputCostPer1M: 10.00, cacheReadCostPer1M: 0.3125, cacheWriteCostPer1M: 4.50 },
  // ── GitHub Copilot / Models ─────────────────────────────────────────────────
  "copilot-gpt-4o":              { inputCostPer1M: 2.50,  outputCostPer1M: 10.00, cacheReadCostPer1M: 1.25,  cacheWriteCostPer1M: 0 },
  "copilot/gpt-4o":              { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "copilot/claude-3.5-sonnet":   { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "copilot/o3-mini":             { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "github/gpt-4o":               { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "github/phi-4":                { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── xAI / Grok ──────────────────────────────────────────────────────────────
  "grok-3":                      { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "grok-3-mini":                 { inputCostPer1M: 0.30,  outputCostPer1M: 0.50,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "grok-3-fast":                 { inputCostPer1M: 5.00,  outputCostPer1M: 25.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "grok-2":                      { inputCostPer1M: 2.00,  outputCostPer1M: 10.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "grok-2-vision":               { inputCostPer1M: 2.00,  outputCostPer1M: 10.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Cohere ──────────────────────────────────────────────────────────────────
  "command-r-plus":              { inputCostPer1M: 2.50,  outputCostPer1M: 10.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "command-r":                   { inputCostPer1M: 0.15,  outputCostPer1M: 0.60,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "command-a-03-2025":           { inputCostPer1M: 2.50,  outputCostPer1M: 10.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "command-r7b":                 { inputCostPer1M: 0.0375,outputCostPer1M: 0.15,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Together AI ─────────────────────────────────────────────────────────────
  "together/llama-3.1-405b":     { inputCostPer1M: 3.50,  outputCostPer1M: 3.50,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "together/llama-3.1-70b":      { inputCostPer1M: 0.88,  outputCostPer1M: 0.88,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "together/mixtral-8x22b":      { inputCostPer1M: 1.20,  outputCostPer1M: 1.20,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "together/qwen-2.5-72b":       { inputCostPer1M: 1.20,  outputCostPer1M: 1.20,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Fireworks AI ────────────────────────────────────────────────────────────
  "fw/llama-v3p1-405b":          { inputCostPer1M: 3.00,  outputCostPer1M: 3.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "fw/llama-v3p1-70b":           { inputCostPer1M: 0.90,  outputCostPer1M: 0.90,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "fw/qwen2p5-72b":              { inputCostPer1M: 0.90,  outputCostPer1M: 0.90,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "fw/deepseek-r1":              { inputCostPer1M: 8.00,  outputCostPer1M: 8.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Azure OpenAI ────────────────────────────────────────────────────────────
  "azure/gpt-4o":                { inputCostPer1M: 2.50,  outputCostPer1M: 10.00, cacheReadCostPer1M: 1.25,  cacheWriteCostPer1M: 0 },
  "azure/gpt-4o-mini":           { inputCostPer1M: 0.15,  outputCostPer1M: 0.60,  cacheReadCostPer1M: 0.075, cacheWriteCostPer1M: 0 },
  "azure/gpt-4-turbo":           { inputCostPer1M: 10.00, outputCostPer1M: 30.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "azure/o3-mini":               { inputCostPer1M: 1.10,  outputCostPer1M: 4.40,  cacheReadCostPer1M: 0.55,  cacheWriteCostPer1M: 0 },
  // ── Amazon Bedrock ──────────────────────────────────────────────────────────
  "bedrock/claude-3-5-sonnet":   { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30,  cacheWriteCostPer1M: 3.75 },
  "bedrock/claude-3-haiku":      { inputCostPer1M: 0.25,  outputCostPer1M: 1.25,  cacheReadCostPer1M: 0.025, cacheWriteCostPer1M: 0.3125 },
  "bedrock/llama-3-70b":         { inputCostPer1M: 0.72,  outputCostPer1M: 0.72,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "bedrock/titan-text-lite":     { inputCostPer1M: 0.30,  outputCostPer1M: 0.40,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Vertex AI ───────────────────────────────────────────────────────────────
  "vertex/gemini-2.5-pro":       { inputCostPer1M: 1.25,  outputCostPer1M: 10.00, cacheReadCostPer1M: 0.3125, cacheWriteCostPer1M: 4.50 },
  "vertex/claude-3-5-sonnet":    { inputCostPer1M: 3.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0.30,  cacheWriteCostPer1M: 3.75 },
  "vertex/llama-3.1-405b":       { inputCostPer1M: 4.00,  outputCostPer1M: 16.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Cloudflare Workers AI ────────────────────────────────────────────────────
  "cf/llama-3.1-8b":             { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "cf/mistral-7b":               { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Cerebras ────────────────────────────────────────────────────────────────
  "cerebras/llama-3.3-70b":      { inputCostPer1M: 0.85,  outputCostPer1M: 1.20,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "cerebras/llama-3.1-8b":       { inputCostPer1M: 0.10,  outputCostPer1M: 0.10,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Ollama (local) ──────────────────────────────────────────────────────────
  "ollama/llama3.2":             { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "ollama/qwen2.5":              { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "ollama/deepseek-r1":          { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Databricks ──────────────────────────────────────────────────────────────
  "databricks/dbrx":             { inputCostPer1M: 0.75,  outputCostPer1M: 2.25,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "databricks/meta-llama-3-70b": { inputCostPer1M: 1.00,  outputCostPer1M: 3.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Hugging Face ────────────────────────────────────────────────────────────
  "hf/meta-llama-3.1-70b":       { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "hf/mistral-7b":               { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Moonshot AI ─────────────────────────────────────────────────────────────
  "moonshot-v1-8k":              { inputCostPer1M: 0.17,  outputCostPer1M: 0.17,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "moonshot-v1-32k":             { inputCostPer1M: 0.35,  outputCostPer1M: 0.35,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "moonshot-v1-128k":            { inputCostPer1M: 0.87,  outputCostPer1M: 0.87,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Zhipu AI ────────────────────────────────────────────────────────────────
  "glm-4-plus":                  { inputCostPer1M: 0.14,  outputCostPer1M: 0.14,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "glm-4-air":                   { inputCostPer1M: 0.014, outputCostPer1M: 0.014, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "glm-4-flash":                 { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── MiniMax ─────────────────────────────────────────────────────────────────
  "minimax/abab7-chat":          { inputCostPer1M: 0.24,  outputCostPer1M: 0.24,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "minimax/abab6.5s":            { inputCostPer1M: 0.11,  outputCostPer1M: 0.11,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Alibaba / Qwen ──────────────────────────────────────────────────────────
  "qwen-max":                    { inputCostPer1M: 0.40,  outputCostPer1M: 1.20,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "qwen-plus":                   { inputCostPer1M: 0.07,  outputCostPer1M: 0.21,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "qwen-turbo":                  { inputCostPer1M: 0.02,  outputCostPer1M: 0.06,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "qwen-long":                   { inputCostPer1M: 0.007, outputCostPer1M: 0.007, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── SiliconFlow ─────────────────────────────────────────────────────────────
  "sf/deepseek-v3":              { inputCostPer1M: 0.14,  outputCostPer1M: 0.28,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "sf/qwen2.5-72b":              { inputCostPer1M: 0.63,  outputCostPer1M: 0.63,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "sf/glm-4-9b":                 { inputCostPer1M: 0,     outputCostPer1M: 0,     cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── StepFun ─────────────────────────────────────────────────────────────────
  "step-2-16k":                  { inputCostPer1M: 0.035, outputCostPer1M: 0.14,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "step-1-8k":                   { inputCostPer1M: 0.007, outputCostPer1M: 0.007, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Upstage ─────────────────────────────────────────────────────────────────
  "solar-pro2":                  { inputCostPer1M: 5.00,  outputCostPer1M: 15.00, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "solar-mini":                  { inputCostPer1M: 0.15,  outputCostPer1M: 0.15,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Novita AI ────────────────────────────────────────────────────────────────
  "novita/llama-3.1-405b":       { inputCostPer1M: 2.40,  outputCostPer1M: 2.40,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "novita/llama-3.1-70b":        { inputCostPer1M: 0.59,  outputCostPer1M: 0.79,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Scaleway ─────────────────────────────────────────────────────────────────
  "scaleway/llama-3.1-70b":      { inputCostPer1M: 0.60,  outputCostPer1M: 0.60,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "scaleway/llama-3.1-8b":       { inputCostPer1M: 0.10,  outputCostPer1M: 0.10,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── DigitalOcean ─────────────────────────────────────────────────────────────
  "do/llama-3.1-70b":            { inputCostPer1M: 0.80,  outputCostPer1M: 0.80,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "do/mistral-nemo":             { inputCostPer1M: 0.30,  outputCostPer1M: 0.30,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Vultr ────────────────────────────────────────────────────────────────────
  "vultr/llama-3.1-70b":         { inputCostPer1M: 0.80,  outputCostPer1M: 0.80,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Nebius ──────────────────────────────────────────────────────────────────
  "nebius/llama-3.1-70b":        { inputCostPer1M: 0.13,  outputCostPer1M: 0.40,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "nebius/deepseek-v3":          { inputCostPer1M: 0.14,  outputCostPer1M: 0.14,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── Meta (direct) ───────────────────────────────────────────────────────────
  "meta/llama-3.1-405b":         { inputCostPer1M: 2.70,  outputCostPer1M: 2.70,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "meta/llama-3.1-70b":          { inputCostPer1M: 0.72,  outputCostPer1M: 0.72,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "meta/llama-3.2-90b":          { inputCostPer1M: 2.00,  outputCostPer1M: 2.00,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  // ── NVIDIA NIM ──────────────────────────────────────────────────────────────
  "nvidia/llama-3.1-nemotron-70b": { inputCostPer1M: 0.35, outputCostPer1M: 0.40, cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
  "nvidia/mistral-nemo-12b":     { inputCostPer1M: 0.23,  outputCostPer1M: 0.23,  cacheReadCostPer1M: 0,     cacheWriteCostPer1M: 0 },
};

// ── Model name normalizer (multi-step resolution) ──────────────────────────────
const TIER_SUFFIXES = ["-thinking", "-high", "-low", "-medium", "-xhigh", "-codex", "-max", "-mini"];
const PREFIXES = ["anthropic/", "openai/", "google/", "bedrock/", "azure/", "vertex_ai/", "xai/"];
const PRICING_KEYS = Object.keys(PRICING_TABLE);

export function normalizeModel(raw: string): string {
  if (typeof raw !== "string") return "unknown";
  const lower = raw.toLowerCase().trim();

  // 1. Cursor overrides (check before exact match)
  if (CURSOR_OVERRIDES[lower]) return lower;

  // 2. Exact match
  if (PRICING_TABLE[lower]) return lower;

  // 3. Alias resolution
  const alias = ALIASES[lower];
  if (alias) {
    if (PRICING_TABLE[alias]) return alias;
  }

  // 4. Strip date suffixes: claude-3-5-sonnet-20241022 -> claude-3-5-sonnet
  const noDate = lower.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (noDate !== lower) {
    // Check alias table for date-stripped name too
    const aliasNoDate = ALIASES[noDate];
    const targetNoDate = aliasNoDate || noDate;
    if (PRICING_TABLE[targetNoDate]) return targetNoDate;
    // Try parent of noDate too
    const noDateDeep = noDate.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
    if (noDateDeep !== noDate && PRICING_TABLE[noDateDeep]) return noDateDeep;
  }

  // 5. Version normalization: claude-3-5-sonnet -> claude-3.5-sonnet
  const normalizedVersion = lower.replace(/(\d)-(\d)/g, "$1.$2");
  if (normalizedVersion !== lower) {
    if (PRICING_TABLE[normalizedVersion]) return normalizedVersion;
    // Also check in aliases
    const aliasVer = ALIASES[normalizedVersion];
    if (aliasVer && PRICING_TABLE[aliasVer]) return aliasVer;
  }

  // 6. Provider prefix stripping
  for (const prefix of PREFIXES) {
    if (lower.startsWith(prefix)) {
      const stripped = lower.slice(prefix.length);
      if (PRICING_TABLE[stripped]) return stripped;
      // Recursive: try version normalization on stripped
      const strippedNorm = stripped.replace(/(\d)-(\d)/g, "$1.$2");
      if (strippedNorm !== stripped && PRICING_TABLE[strippedNorm]) return strippedNorm;
    }
  }
  // Generic prefix stripping for any provider/model pattern
  const slashIdx = lower.indexOf("/");
  if (slashIdx > 0 && slashIdx < 15) {
    const afterSlash = lower.slice(slashIdx + 1);
    if (PRICING_TABLE[afterSlash]) return afterSlash;
  }

  // 7. Tier suffix stripping: gpt-5.2-codex -> gpt-5.2
  for (const tier of TIER_SUFFIXES) {
    if (lower.endsWith(tier)) {
      const base = lower.slice(0, -tier.length);
      if (PRICING_TABLE[base]) return base;
      const baseNoDate = base.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
      if (baseNoDate !== base && PRICING_TABLE[baseNoDate]) return baseNoDate;
    }
  }

  // 8. Fuzzy: longest prefix match
  let bestKey = "";
  for (const key of PRICING_KEYS) {
    if (lower.startsWith(key) && key.length >= 5 && key.length > bestKey.length) bestKey = key;
  }
  if (bestKey) return bestKey;

  // 9. Contains fallback (prefer longest match)
  let bestContains = "";
  for (const key of PRICING_KEYS) {
    if (lower.includes(key) && key.length > bestContains.length) bestContains = key;
  }
  if (bestContains) return bestContains;
  for (const key of PRICING_KEYS) {
    if (key.includes(lower.slice(0, Math.min(lower.length, 20)))) return key;
  }

  return lower; // unknown — return cleaned input
}

// ── Cost calculator ────────────────────────────────────────────────────────────
export function calculateCost(
  model: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  }
): number {
  const key = normalizeModel(model);
  const pricing = PRICING_TABLE[key] || CURSOR_OVERRIDES[key];
  if (!pricing) {
    if (usage.inputTokens > 0 || usage.outputTokens > 0) {
      console.warn(`[Pricing] No pricing entry for model "${model}" (key="${key}")`);
    }
    return 0;
  }
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputCostPer1M +
    (usage.outputTokens / 1_000_000) * pricing.outputCostPer1M +
    (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadCostPer1M +
    (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWriteCostPer1M
  );
}

// ── Get all pricing as flat array (for API) ────────────────────────────────────
export function getAllPricing() {
  return Object.entries(PRICING_TABLE).map(([model, pricing]) => ({
    model,
    inputCostPer1M: pricing.inputCostPer1M,
    outputCostPer1M: pricing.outputCostPer1M,
    cacheReadCostPer1M: pricing.cacheReadCostPer1M,
    cacheWriteCostPer1M: pricing.cacheWriteCostPer1M,
  }));
}

// ── Pricing cache (1hr TTL, like tokscale) ─────────────────────────────────────

interface CachedPricing {
  fetchedAt: number;
  entries: Array<{
    model: string;
    inputCostPer1M: number;
    outputCostPer1M: number;
    cacheReadCostPer1M: number;
    cacheWriteCostPer1M: number;
  }>;
}

function getPricingCachePath(): string {
  return join(getCacheDir(), PRICING_CACHE_FILE);
}

async function loadPricingCache(): Promise<CachedPricing | null> {
  try {
    const raw = await readFile(getPricingCachePath(), "utf-8");
    return JSON.parse(raw) as CachedPricing;
  } catch {
    return null;
  }
}

async function savePricingCache(data: CachedPricing): Promise<void> {
  const dir = getCacheDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(getPricingCachePath(), JSON.stringify(data, null, 2), "utf-8");
}

export async function refreshPricingFromRemote(url?: string): Promise<boolean> {
  const endpoint = url || "https://api.agentpilot.ai/v1/pricing";
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return false;
    const remote: Array<{
      model: string;
      inputCostPer1M: number;
      outputCostPer1M: number;
      cacheReadCostPer1M?: number;
      cacheWriteCostPer1M?: number;
    }> = await res.json();

    let updated = 0;
    for (const entry of remote) {
      if (PRICING_TABLE[entry.model]) {
        PRICING_TABLE[entry.model].inputCostPer1M = entry.inputCostPer1M;
        PRICING_TABLE[entry.model].outputCostPer1M = entry.outputCostPer1M;
        if (entry.cacheReadCostPer1M !== undefined)
          PRICING_TABLE[entry.model].cacheReadCostPer1M = entry.cacheReadCostPer1M;
        if (entry.cacheWriteCostPer1M !== undefined)
          PRICING_TABLE[entry.model].cacheWriteCostPer1M = entry.cacheWriteCostPer1M;
        updated++;
      }
    }

    const cache: CachedPricing = {
      fetchedAt: Date.now(),
      entries: remote.map((e) => ({
        model: e.model,
        inputCostPer1M: e.inputCostPer1M,
        outputCostPer1M: e.outputCostPer1M,
        cacheReadCostPer1M: e.cacheReadCostPer1M ?? 0,
        cacheWriteCostPer1M: e.cacheWriteCostPer1M ?? 0,
      })),
    };
    await savePricingCache(cache);
    return true;
  } catch {
    return false;
  }
}

// Try to hydrate from cache on module load
(async () => {
  const cache = await loadPricingCache();
  if (cache && Date.now() - cache.fetchedAt < PRICING_CACHE_TTL_MS) {
    for (const entry of cache.entries) {
      if (PRICING_TABLE[entry.model]) {
        PRICING_TABLE[entry.model].inputCostPer1M = entry.inputCostPer1M;
        PRICING_TABLE[entry.model].outputCostPer1M = entry.outputCostPer1M;
        PRICING_TABLE[entry.model].cacheReadCostPer1M = entry.cacheReadCostPer1M;
        PRICING_TABLE[entry.model].cacheWriteCostPer1M = entry.cacheWriteCostPer1M;
      }
    }
  }
})().catch((err) => console.warn("[Pricing] Cache load failed:", err));
