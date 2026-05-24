import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
  TextInput,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics, type BudgetAlert } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";
import { formatCost, formatTokens } from "../../lib/format";

// ── Provider colors ─────────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  openai:        "#10A37F",
  anthropic:     "#CC785C",
  google:        "#FF8800",   // was #4285F4 blue → brand orange
  groq:          "#F55036",
  deepseek:      "#FF8800",   // was #4D6EFF blue → orange
  mistral:       "#FF7000",
  perplexity:    "#20B2AA",
  openrouter:    "#9B59B6",
  cohere:        "#39C5BB",
  together:      "#FF4785",
  fireworks:     "#FF6B35",
  azure:         "#AAAAAA",   // was #0089D6 blue → neutral grey
  amazon:        "#FF9900",
  xai:           "#AAAAAA",
  meta:          "#FF8800",   // was #0082FB blue → orange
  nvidia:        "#76B900",
  "01ai":        "#AAAAAA",   // was #00D4FF cyan → neutral
  inflection:    "#FF6680",
  github:        "#F0F0F0",
  vertex:        "#FF8800",   // was #4285F4 blue → orange
  cloudflare:    "#F38020",
  cerebras:      "#FF6B6B",
  ollama:        "#AAAAAA",   // was #7B68EE purple-blue → neutral
  databricks:    "#FF3621",
  huggingface:   "#FFD21E",
  zhipu:         "#00D4B4",
  moonshot:      "#9B59B6",
  minimax:       "#FF69B4",
  alibaba:       "#FF6A00",
  siliconflow:   "#20B2AA",   // was #06B6D4 cyan → teal
  volcengine:    "#FF4500",
  baidu:         "#FF8800",   // was #2932E1 blue → orange
  tencent:       "#07C160",
  stepfun:       "#9B59B6",
  upstage:       "#FF8800",   // was #3B82F6 blue → orange
  novita:        "#EC4899",
  scaleway:      "#9B59B6",
  digitalocean:  "#AAAAAA",   // was #0080FF blue → neutral
  vultr:         "#AAAAAA",   // was #007BFC blue → neutral
  nebius:        "#9B59B6",   // was #6366F1 indigo → purple
  other:         "#888888",
};

// ── Full model pricing data ─────────────────────────────────────────────────
interface ModelPrice { in: number; out: number; provider: string; note?: string }

const MODEL_PRICING: Record<string, ModelPrice> = {
  // ── OpenAI ──────────────────────────────────────────────────────────────
  "gpt-4.1":                    { in: 2.00,   out: 8.00,   provider: "openai"     },
  "gpt-4.1-mini":               { in: 0.40,   out: 1.60,   provider: "openai"     },
  "gpt-4.1-nano":               { in: 0.10,   out: 0.40,   provider: "openai"     },
  "gpt-4o":                     { in: 2.50,   out: 10.00,  provider: "openai"     },
  "gpt-4o-mini":                { in: 0.15,   out: 0.60,   provider: "openai"     },
  "gpt-4-turbo":                { in: 10.00,  out: 30.00,  provider: "openai"     },
  "gpt-4":                      { in: 30.00,  out: 60.00,  provider: "openai"     },
  "gpt-3.5-turbo":              { in: 0.50,   out: 1.50,   provider: "openai"     },
  "o1":                         { in: 15.00,  out: 60.00,  provider: "openai"     },
  "o1-mini":                    { in: 3.00,   out: 12.00,  provider: "openai"     },
  "o1-pro":                     { in: 150.00, out: 600.00, provider: "openai"     },
  "o3":                         { in: 10.00,  out: 40.00,  provider: "openai"     },
  "o3-mini":                    { in: 1.10,   out: 4.40,   provider: "openai"     },
  "o4-mini":                    { in: 1.10,   out: 4.40,   provider: "openai"     },
  // ── Anthropic ────────────────────────────────────────────────────────────
  "claude-opus-4":              { in: 15.00,  out: 75.00,  provider: "anthropic"  },
  "claude-opus-4-5":            { in: 15.00,  out: 75.00,  provider: "anthropic"  },
  "claude-sonnet-4":            { in: 3.00,   out: 15.00,  provider: "anthropic"  },
  "claude-sonnet-4-5":          { in: 3.00,   out: 15.00,  provider: "anthropic"  },
  "claude-3-7-sonnet":          { in: 3.00,   out: 15.00,  provider: "anthropic"  },
  "claude-3-5-sonnet-20241022": { in: 3.00,   out: 15.00,  provider: "anthropic"  },
  "claude-3-5-haiku-20241022":  { in: 0.80,   out: 4.00,   provider: "anthropic"  },
  "claude-haiku-4.5":           { in: 1.00,   out: 5.00,   provider: "anthropic"  },
  "claude-haiku-3.5":           { in: 0.80,   out: 4.00,   provider: "anthropic"  },
  "claude-haiku-3":             { in: 0.25,   out: 1.25,   provider: "anthropic"  },
  "claude-3-opus":              { in: 15.00,  out: 75.00,  provider: "anthropic"  },
  // ── Google ───────────────────────────────────────────────────────────────
  "gemini-2.5-pro":             { in: 1.25,   out: 10.00,  provider: "google"     },
  "gemini-2.5-flash":           { in: 0.30,   out: 2.50,   provider: "google"     },
  "gemini-2.5-flash-lite":      { in: 0.10,   out: 0.40,   provider: "google"     },
  "gemini-2.0-flash":           { in: 0.10,   out: 0.40,   provider: "google"     },
  "gemini-2.0-flash-lite":      { in: 0.075,  out: 0.30,   provider: "google"     },
  "gemini-1.5-pro":             { in: 1.25,   out: 5.00,   provider: "google"     },
  "gemini-1.5-flash":           { in: 0.075,  out: 0.30,   provider: "google"     },
  "gemini-1.0-pro":             { in: 0.50,   out: 1.50,   provider: "google"     },
  // ── Groq ─────────────────────────────────────────────────────────────────
  "llama-3.3-70b-versatile":    { in: 0.59,   out: 0.79,   provider: "groq"       },
  "llama-3.1-8b-instant":       { in: 0.05,   out: 0.08,   provider: "groq"       },
  "llama-3.1-70b-versatile":    { in: 0.59,   out: 0.79,   provider: "groq"       },
  "llama-3.2-90b-vision":       { in: 0.90,   out: 0.90,   provider: "groq"       },
  "llama-3.2-11b-vision":       { in: 0.18,   out: 0.18,   provider: "groq"       },
  "llama-3.2-3b-preview":       { in: 0.06,   out: 0.06,   provider: "groq"       },
  "llama-3.2-1b-preview":       { in: 0.04,   out: 0.04,   provider: "groq"       },
  "mixtral-8x7b-32768":         { in: 0.24,   out: 0.24,   provider: "groq"       },
  "gemma2-9b-it":               { in: 0.20,   out: 0.20,   provider: "groq"       },
  "deepseek-r1-distill-llama-70b": { in: 0.75, out: 0.99, provider: "groq"       },
  // ── DeepSeek ─────────────────────────────────────────────────────────────
  "deepseek-v3":                { in: 0.14,   out: 0.28,   provider: "deepseek"   },
  "deepseek-v3-0324":           { in: 0.14,   out: 0.28,   provider: "deepseek"   },
  "deepseek-r1":                { in: 0.55,   out: 2.19,   provider: "deepseek"   },
  "deepseek-r1-0528":           { in: 0.55,   out: 2.19,   provider: "deepseek"   },
  "deepseek-coder-v2":          { in: 0.14,   out: 0.28,   provider: "deepseek"   },
  "deepseek-v2.5":              { in: 0.14,   out: 0.28,   provider: "deepseek"   },
  // ── Mistral ──────────────────────────────────────────────────────────────
  "mistral-large-latest":       { in: 2.00,   out: 6.00,   provider: "mistral"    },
  "mistral-large-2411":         { in: 2.00,   out: 6.00,   provider: "mistral"    },
  "mistral-medium":             { in: 0.40,   out: 1.20,   provider: "mistral"    },
  "mistral-small-latest":       { in: 0.10,   out: 0.30,   provider: "mistral"    },
  "mistral-small-2503":         { in: 0.10,   out: 0.30,   provider: "mistral"    },
  "codestral-latest":           { in: 0.20,   out: 0.60,   provider: "mistral"    },
  "codestral-2501":             { in: 0.30,   out: 0.90,   provider: "mistral"    },
  "mistral-7b-instruct":        { in: 0.025,  out: 0.025,  provider: "mistral"    },
  "mixtral-8x22b":              { in: 1.20,   out: 1.20,   provider: "mistral"    },
  "pixtral-large-latest":       { in: 2.00,   out: 6.00,   provider: "mistral"    },
  // ── Perplexity ───────────────────────────────────────────────────────────
  "sonar-pro":                  { in: 3.00,   out: 15.00,  provider: "perplexity" },
  "sonar":                      { in: 1.00,   out: 1.00,   provider: "perplexity" },
  "sonar-reasoning":            { in: 1.00,   out: 5.00,   provider: "perplexity" },
  "sonar-reasoning-pro":        { in: 2.00,   out: 8.00,   provider: "perplexity" },
  "sonar-deep-research":        { in: 2.00,   out: 8.00,   provider: "perplexity" },
  // ── OpenRouter ───────────────────────────────────────────────────────────
  "openrouter/auto":            { in: 0,      out: 0,      provider: "openrouter", note: "varies" },
  "openrouter/anthropic/claude-3.5-sonnet": { in: 3.00, out: 15.00, provider: "openrouter" },
  "openrouter/openai/gpt-4o":   { in: 2.50,  out: 10.00,  provider: "openrouter" },
  "openrouter/google/gemini-2.5-pro": { in: 1.25, out: 10.00, provider: "openrouter" },
  // ── GitHub Copilot ───────────────────────────────────────────────────────
  "copilot/gpt-4o":             { in: 0,      out: 0,      provider: "github",    note: "subscription" },
  "copilot/claude-3.5-sonnet":  { in: 0,      out: 0,      provider: "github",    note: "subscription" },
  "copilot/o3-mini":            { in: 0,      out: 0,      provider: "github",    note: "subscription" },
  // ── GitHub Models ────────────────────────────────────────────────────────
  "github/gpt-4o":              { in: 0,      out: 0,      provider: "github",    note: "free tier" },
  "github/phi-4":               { in: 0,      out: 0,      provider: "github",    note: "free tier" },
  // ── xAI / Grok ───────────────────────────────────────────────────────────
  "grok-3":                     { in: 3.00,   out: 15.00,  provider: "xai"        },
  "grok-3-mini":                { in: 0.30,   out: 0.50,   provider: "xai"        },
  "grok-3-fast":                { in: 5.00,   out: 25.00,  provider: "xai"        },
  "grok-2":                     { in: 2.00,   out: 10.00,  provider: "xai"        },
  "grok-2-vision":              { in: 2.00,   out: 10.00,  provider: "xai"        },
  // ── Cohere ───────────────────────────────────────────────────────────────
  "command-r-plus":             { in: 2.50,   out: 10.00,  provider: "cohere"     },
  "command-r":                  { in: 0.15,   out: 0.60,   provider: "cohere"     },
  "command-a-03-2025":          { in: 2.50,   out: 10.00,  provider: "cohere"     },
  "command-r7b":                { in: 0.0375, out: 0.15,   provider: "cohere"     },
  // ── Together AI ──────────────────────────────────────────────────────────
  "together/llama-3.1-405b":    { in: 3.50,   out: 3.50,   provider: "together"   },
  "together/llama-3.1-70b":     { in: 0.88,   out: 0.88,   provider: "together"   },
  "together/mixtral-8x22b":     { in: 1.20,   out: 1.20,   provider: "together"   },
  "together/qwen-2.5-72b":      { in: 1.20,   out: 1.20,   provider: "together"   },
  // ── Fireworks AI ─────────────────────────────────────────────────────────
  "fw/llama-v3p1-405b":         { in: 3.00,   out: 3.00,   provider: "fireworks"  },
  "fw/llama-v3p1-70b":          { in: 0.90,   out: 0.90,   provider: "fireworks"  },
  "fw/qwen2p5-72b":             { in: 0.90,   out: 0.90,   provider: "fireworks"  },
  "fw/deepseek-r1":             { in: 8.00,   out: 8.00,   provider: "fireworks"  },
  // ── Azure OpenAI ─────────────────────────────────────────────────────────
  "azure/gpt-4o":               { in: 2.50,   out: 10.00,  provider: "azure"      },
  "azure/gpt-4o-mini":          { in: 0.15,   out: 0.60,   provider: "azure"      },
  "azure/gpt-4-turbo":          { in: 10.00,  out: 30.00,  provider: "azure"      },
  "azure/o3-mini":              { in: 1.10,   out: 4.40,   provider: "azure"      },
  // ── Amazon Bedrock ───────────────────────────────────────────────────────
  "bedrock/claude-3-5-sonnet":  { in: 3.00,   out: 15.00,  provider: "amazon"     },
  "bedrock/claude-3-haiku":     { in: 0.25,   out: 1.25,   provider: "amazon"     },
  "bedrock/llama-3-70b":        { in: 0.72,   out: 0.72,   provider: "amazon"     },
  "bedrock/titan-text-lite":    { in: 0.30,   out: 0.40,   provider: "amazon"     },
  // ── Vertex AI (Google Cloud) ──────────────────────────────────────────────
  "vertex/gemini-2.5-pro":      { in: 1.25,   out: 10.00,  provider: "vertex"     },
  "vertex/claude-3-5-sonnet":   { in: 3.00,   out: 15.00,  provider: "vertex"     },
  "vertex/llama-3.1-405b":      { in: 4.00,   out: 16.00,  provider: "vertex"     },
  // ── Cloudflare Workers AI ─────────────────────────────────────────────────
  "cf/llama-3.1-8b":            { in: 0,      out: 0,      provider: "cloudflare", note: "free tier" },
  "cf/mistral-7b":              { in: 0,      out: 0,      provider: "cloudflare", note: "free tier" },
  // ── Cerebras ─────────────────────────────────────────────────────────────
  "cerebras/llama-3.3-70b":     { in: 0.85,   out: 1.20,   provider: "cerebras"   },
  "cerebras/llama-3.1-8b":      { in: 0.10,   out: 0.10,   provider: "cerebras"   },
  // ── Ollama (local) ───────────────────────────────────────────────────────
  "ollama/llama3.2":            { in: 0,      out: 0,      provider: "ollama",    note: "local" },
  "ollama/qwen2.5":             { in: 0,      out: 0,      provider: "ollama",    note: "local" },
  "ollama/deepseek-r1":         { in: 0,      out: 0,      provider: "ollama",    note: "local" },
  // ── Databricks ───────────────────────────────────────────────────────────
  "databricks/dbrx":            { in: 0.75,   out: 2.25,   provider: "databricks" },
  "databricks/meta-llama-3-70b": { in: 1.00,  out: 3.00,   provider: "databricks" },
  // ── Hugging Face ─────────────────────────────────────────────────────────
  "hf/meta-llama-3.1-70b":      { in: 0,      out: 0,      provider: "huggingface", note: "free tier" },
  "hf/mistral-7b":              { in: 0,      out: 0,      provider: "huggingface", note: "free tier" },
  // ── Moonshot AI ──────────────────────────────────────────────────────────
  "moonshot-v1-8k":             { in: 0.17,   out: 0.17,   provider: "moonshot"   },
  "moonshot-v1-32k":            { in: 0.35,   out: 0.35,   provider: "moonshot"   },
  "moonshot-v1-128k":           { in: 0.87,   out: 0.87,   provider: "moonshot"   },
  // ── Zhipu AI ─────────────────────────────────────────────────────────────
  "glm-4-plus":                 { in: 0.14,   out: 0.14,   provider: "zhipu"      },
  "glm-4-air":                  { in: 0.014,  out: 0.014,  provider: "zhipu"      },
  "glm-4-flash":                { in: 0,      out: 0,      provider: "zhipu",     note: "free" },
  // ── MiniMax ──────────────────────────────────────────────────────────────
  "minimax/abab7-chat":         { in: 0.24,   out: 0.24,   provider: "minimax"    },
  "minimax/abab6.5s":           { in: 0.11,   out: 0.11,   provider: "minimax"    },
  // ── Alibaba / Qwen ───────────────────────────────────────────────────────
  "qwen-max":                   { in: 0.40,   out: 1.20,   provider: "alibaba"    },
  "qwen-plus":                  { in: 0.07,   out: 0.21,   provider: "alibaba"    },
  "qwen-turbo":                 { in: 0.02,   out: 0.06,   provider: "alibaba"    },
  "qwen-long":                  { in: 0.007,  out: 0.007,  provider: "alibaba"    },
  // ── SiliconFlow ──────────────────────────────────────────────────────────
  "sf/deepseek-v3":             { in: 0.14,   out: 0.28,   provider: "siliconflow" },
  "sf/qwen2.5-72b":             { in: 0.63,   out: 0.63,   provider: "siliconflow" },
  "sf/glm-4-9b":                { in: 0,      out: 0,      provider: "siliconflow", note: "free" },
  // ── StepFun ──────────────────────────────────────────────────────────────
  "step-2-16k":                 { in: 0.035,  out: 0.14,   provider: "stepfun"    },
  "step-1-8k":                  { in: 0.007,  out: 0.007,  provider: "stepfun"    },
  // ── Upstage ──────────────────────────────────────────────────────────────
  "solar-pro2":                 { in: 5.00,   out: 15.00,  provider: "upstage"    },
  "solar-mini":                 { in: 0.15,   out: 0.15,   provider: "upstage"    },
  // ── Novita AI ────────────────────────────────────────────────────────────
  "novita/llama-3.1-405b":      { in: 2.40,   out: 2.40,   provider: "novita"     },
  "novita/llama-3.1-70b":       { in: 0.59,   out: 0.79,   provider: "novita"     },
  // ── Scaleway ─────────────────────────────────────────────────────────────
  "scaleway/llama-3.1-70b":     { in: 0.60,   out: 0.60,   provider: "scaleway"   },
  "scaleway/llama-3.1-8b":      { in: 0.10,   out: 0.10,   provider: "scaleway"   },
  // ── DigitalOcean ──────────────────────────────────────────────────────────
  "do/llama-3.1-70b":           { in: 0.80,   out: 0.80,   provider: "digitalocean" },
  "do/mistral-nemo":            { in: 0.30,   out: 0.30,   provider: "digitalocean" },
  // ── Vultr ─────────────────────────────────────────────────────────────────
  "vultr/llama-3.1-70b":        { in: 0.80,   out: 0.80,   provider: "vultr"      },
  // ── Nebius ───────────────────────────────────────────────────────────────
  "nebius/llama-3.1-70b":       { in: 0.13,   out: 0.40,   provider: "nebius"     },
  "nebius/deepseek-v3":         { in: 0.14,   out: 0.14,   provider: "nebius"     },
  // ── Meta (direct) ────────────────────────────────────────────────────────
  "meta/llama-3.1-405b":        { in: 2.70,   out: 2.70,   provider: "meta"       },
  "meta/llama-3.1-70b":         { in: 0.72,   out: 0.72,   provider: "meta"       },
  "meta/llama-3.2-90b":         { in: 2.00,   out: 2.00,   provider: "meta"       },
  // ── NVIDIA NIM ───────────────────────────────────────────────────────────
  "nvidia/llama-3.1-nemotron-70b": { in: 0.35, out: 0.40,  provider: "nvidia"     },
  "nvidia/mistral-nemo-12b":    { in: 0.23,   out: 0.23,   provider: "nvidia"     },
};

// ── Provider display names ──────────────────────────────────────────────────
const PROVIDER_DISPLAY: Record<string, string> = {
  openai: "OpenAI", anthropic: "Anthropic", google: "Google", groq: "Groq",
  deepseek: "DeepSeek", mistral: "Mistral", perplexity: "Perplexity",
  openrouter: "OpenRouter", github: "GitHub (Copilot/Models)", xai: "xAI / Grok",
  cohere: "Cohere", together: "Together AI", fireworks: "Fireworks AI",
  azure: "Azure OpenAI", amazon: "Amazon Bedrock", vertex: "Vertex AI",
  cloudflare: "Cloudflare Workers AI", cerebras: "Cerebras",
  ollama: "Ollama (local)", databricks: "Databricks",
  huggingface: "Hugging Face", moonshot: "Moonshot AI",
  zhipu: "Zhipu AI", minimax: "MiniMax", alibaba: "Alibaba / Qwen",
  siliconflow: "SiliconFlow", stepfun: "StepFun", upstage: "Upstage",
  novita: "Novita AI", scaleway: "Scaleway", digitalocean: "DigitalOcean",
  vultr: "Vultr", nebius: "Nebius", meta: "Meta (direct)", nvidia: "NVIDIA NIM",
};

const PROVIDER_ORDER = [
  "openai","anthropic","google","groq","deepseek","mistral","perplexity",
  "openrouter","github","xai","cohere","together","fireworks","azure",
  "amazon","vertex","cloudflare","cerebras","ollama","databricks",
  "huggingface","moonshot","zhipu","minimax","alibaba","siliconflow",
  "stepfun","upstage","novita","scaleway","digitalocean","vultr","nebius",
  "meta","nvidia",
];

interface ProviderGroup { id: string; models: [string, ModelPrice][] }
function buildGroups(): ProviderGroup[] {
  const map = new Map<string, [string, ModelPrice][]>();
  for (const [model, price] of Object.entries(MODEL_PRICING)) {
    const pid = price.provider;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push([model, price]);
  }
  const result: ProviderGroup[] = [];
  for (const pid of PROVIDER_ORDER) {
    if (map.has(pid)) result.push({ id: pid, models: map.get(pid)! });
  }
  for (const [pid, models] of map) {
    if (!PROVIDER_ORDER.includes(pid)) result.push({ id: pid, models });
  }
  return result;
}
const PROVIDER_GROUPS = buildGroups();

// ── Pricing sheet ───────────────────────────────────────────────────────────
function ModelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [search, setSearch] = useState("");

  React.useEffect(() => {
    if (visible) {
      setSearch("");
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 600, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const q = search.toLowerCase().trim();
  const filteredGroups = PROVIDER_GROUPS.map((g) => ({
    ...g,
    models: g.models.filter(([m]) => !q || m.toLowerCase().includes(q) || g.id.toLowerCase().includes(q)),
  })).filter((g) => g.models.length > 0);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View style={[mo.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[mo.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideY }] }]}>
          <View style={mo.handle} />
          <View style={mo.sheetHead}>
            <View>
              <Text style={mo.sheetTitle}>MODEL PRICING</Text>
              <Text style={mo.sheetSub}>{Object.keys(MODEL_PRICING).length} models · {PROVIDER_GROUPS.length} providers</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={16} activeOpacity={0.7} style={mo.closeBtn}>
              <Text style={mo.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={mo.searchWrap}>
            <Text style={mo.searchIcon}>⌕ </Text>
            <TextInput
              style={mo.searchInput}
              placeholder="Search provider or model..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Text style={mo.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={mo.divider} />
          <View style={mo.tableHead}>
            <Text style={[{ flex: 1 }, mo.headCell]}>MODEL</Text>
            <Text style={[{ width: 68 }, mo.headCell, { textAlign: "right" }]}>IN /1M</Text>
            <Text style={[{ width: 68 }, mo.headCell, { textAlign: "right" }]}>OUT /1M</Text>
          </View>
          <View style={mo.divider} />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {filteredGroups.length === 0 ? (
              <View style={mo.emptySearch}>
                <Text style={mo.emptySearchText}>No models found for "{search}"</Text>
              </View>
            ) : filteredGroups.map((group) => {
              const pColor = PROVIDER_COLORS[group.id] ?? PROVIDER_COLORS.other;
              const displayName = PROVIDER_DISPLAY[group.id] ?? group.id.toUpperCase();
              return (
                <View key={group.id}>
                  <View style={[mo.providerHeader, { borderLeftColor: pColor }]}>
                    <View style={[mo.providerDotLg, { backgroundColor: pColor }]} />
                    <Text style={[mo.providerLabel, { color: pColor }]}>{displayName}</Text>
                    <Text style={mo.providerCount}>{group.models.length} models</Text>
                  </View>
                  {group.models.map(([model, price], i) => (
                    <View key={model}>
                      <View style={mo.tableRow}>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingRight: 8 }}>
                          <View style={[mo.providerDot, { backgroundColor: pColor }]} />
                          <Text style={mo.modelName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{model}</Text>
                        </View>
                        <Text style={[{ width: 68 }, mo.priceCell, { textAlign: "right" }]}>
                          {price.note ? (
                            <Text style={mo.noteCell}>{price.note}</Text>
                          ) : `$${price.in}`}
                        </Text>
                        <Text style={[{ width: 68 }, mo.priceCell, { textAlign: "right" }]}>
                          {price.note ? "—" : `$${price.out}`}
                        </Text>
                      </View>
                      {i < group.models.length - 1 && <View style={mo.rowDivider} />}
                    </View>
                  ))}
                  <View style={mo.divider} />
                </View>
              );
            })}
            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Animated bar ─────────────────────────────────────────────────────────────
function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const w = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 750, delay, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={co.barTrack}>
      <Animated.View style={[co.barFill, {
        width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        backgroundColor: color,
        shadowColor: color,
        shadowRadius: 5,
        shadowOpacity: 0.7,
      }]} />
    </View>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={co.errorBlock}>
      <View style={co.errorIcon}><Text style={co.errorIconText}>!</Text></View>
      <Text style={co.errorLabel}>LOAD FAILED</Text>
      <Text style={co.errorSub}>Could not fetch cost data</Text>
      <TouchableOpacity style={co.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={co.retryText}>↻  RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Animated stat chip ────────────────────────────────────────────────────────
function StatChip({ label, value, color, delay = 0 }: { label: string; value: string; color?: string; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(14)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay, useNativeDriver: true, damping: 18, stiffness: 180 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[co.heroChip, { opacity, transform: [{ translateY: slideY }] }]}>
      <Text style={co.heroChipLabel}>{label}</Text>
      <Text style={[co.heroChipVal, color ? { color } : {}]}>{value}</Text>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats]           = useState<Analytics | null>(null);
  const [alerts, setAlerts]         = useState<BudgetAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [error, setError]           = useState(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroSlide   = useRef(new Animated.Value(20)).current;

  const load = useCallback(async (silent = false) => {
    setError(false);
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const [analyticsResult, alertsResult] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getAlerts(),
      ]);
      if (analyticsResult.status === "fulfilled") {
        setStats(analyticsResult.value);
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(heroSlide,   { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        ]).start();
      } else {
        setError(true);
      }
      if (alertsResult.status === "fulfilled") {
        setAlerts(alertsResult.value.alerts || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") setError(true);
    } finally {
      clearTimeout(timer);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const totalCost   = parseFloat(String(stats?.totalCost   || "0"));
  const todayCost   = parseFloat(String(stats?.dailyCost   || "0"));
  const monthlyCost = parseFloat(String(stats?.monthlyCost || "0"));
  const totalTokens = stats?.totalTokens || 0;

  const heroCostColor =
    totalCost > 50 ? colors.danger :
    totalCost > 10 ? colors.warning :
    colors.success;

  const sorted   = stats?.modelBreakdown
    ? [...stats.modelBreakdown].sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))
    : [];
  const maxCost = sorted.length > 0 ? parseFloat(sorted[0].totalCost) : 1;

  return (
    <View style={[co.root, { paddingTop: insets.top }]}>
      {/* ── Top bar ── */}
      <View style={co.topBar}>
        <View style={co.topLeft}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.6} style={co.backBtn}>
            <Text style={co.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={co.pageTitle}>COST</Text>
        </View>
        <TouchableOpacity onPress={() => setShowPricing(true)} style={co.pricingBtn} activeOpacity={0.7}>
          <Text style={co.pricingBtnText}>PRICING ↗</Text>
        </TouchableOpacity>
      </View>
      <View style={co.topAccent} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(false); }}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? <ErrorState onRetry={() => load(false)} /> : (
          <>
            {/* Budget alerts */}
            {alerts.length > 0 && (
              <View style={co.alertsBlock}>
                {alerts.map((alert, i) => {
                  const isCritical = alert.level === "critical";
                  const ac = isCritical ? colors.danger : colors.warning;
                  return (
                    <View key={i} style={[co.alertRow, { borderColor: ac + "40", backgroundColor: ac + "10" }]}>
                      <View style={[co.alertStripe, { backgroundColor: ac }]} />
                      <Text style={[co.alertText, { color: ac }]}>
                        {isCritical ? "⚠ " : "▲ "}{alert.message}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Hero */}
            <Animated.View style={[co.heroBlock, { opacity: heroOpacity, transform: [{ translateY: heroSlide }] }]}>
              <Text style={co.heroLabel}>ALL-TIME SPEND</Text>
              <Text style={[co.heroCost, {
                color: heroCostColor,
                textShadowColor: heroCostColor + "60",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 28,
              }]}>
                {formatCost(totalCost)}
              </Text>
              <View style={co.heroRow}>
                <StatChip label="TODAY"      value={formatCost(todayCost)}   color={todayCost > 1 ? colors.warning : colors.text} delay={0} />
                <StatChip label="THIS MONTH" value={formatCost(monthlyCost)} color={monthlyCost > 10 ? colors.warning : colors.text} delay={80} />
                <StatChip label="TOKENS"     value={formatTokens(totalTokens)} delay={160} />
              </View>
            </Animated.View>

            {/* By model */}
            <View style={co.sectionHead}>
              <Text style={co.sectionLabel}>BY MODEL</Text>
              <View style={co.sectionLine} />
            </View>

            {sorted.length > 0 ? (
              <View style={co.modelBlock}>
                {sorted.map((m, i) => {
                  const cost = parseFloat(m.totalCost);
                  const pct  = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                  const pColor = PROVIDER_COLORS[MODEL_PRICING[m.model]?.provider ?? ""] ?? colors.accent;
                  const isTop  = i === 0;
                  return (
                    <View key={m.model} style={[co.modelRow, isTop && co.modelRowTop]}>
                      <View style={co.modelLeft}>
                        <View style={[co.providerDot, { backgroundColor: pColor }]} />
                        <Text style={[co.modelName, isTop && { color: colors.text }]} numberOfLines={1}>{m.model}</Text>
                      </View>
                      <View style={co.barWrap}>
                        <AnimatedBar pct={Math.max(pct, 1)} color={isTop ? pColor : pColor + "80"} delay={i * 80} />
                      </View>
                      <Text style={[co.modelCost, isTop && { color: pColor }]}>{formatCost(cost)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={co.emptyModel}>
                <Text style={co.emptyModelText}>No session data yet</Text>
              </View>
            )}

            {/* Efficiency */}
            {stats && (
              <>
                <View style={co.sectionHead}>
                  <Text style={co.sectionLabel}>EFFICIENCY</Text>
                  <View style={co.sectionLine} />
                </View>
                <View style={co.efficiencyBlock}>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>CACHE HIT RATE</Text>
                    <Text style={[co.effValue, { color: (stats.cacheHitRate ?? 0) > 0.5 ? colors.success : colors.text }]}>
                      {Math.round((stats.cacheHitRate ?? 0) * 100)}%
                    </Text>
                  </View>
                  <View style={co.effBarTrack}>
                    <View style={[co.effBarFill, {
                      width: `${Math.round((stats.cacheHitRate ?? 0) * 100)}%` as any,
                      backgroundColor: (stats.cacheHitRate ?? 0) > 0.5 ? colors.success : colors.accent,
                    }]} />
                  </View>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>PROJECTED MONTHLY</Text>
                    <Text style={[co.effValue, { color: (stats.projectedMonthlyCost ?? 0) > 20 ? colors.warning : colors.text }]}>
                      {formatCost(stats.projectedMonthlyCost ?? 0)}
                    </Text>
                  </View>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>AVG / SESSION</Text>
                    <Text style={co.effValue}>
                      {(stats.totalSessions ?? 0) > 0 ? formatCost(totalCost / stats.totalSessions) : "$0.00"}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 56 }} />
      </ScrollView>

      <ModelSheet visible={showPricing} onClose={() => setShowPricing(false)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const co = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topAccent: { height: 1, backgroundColor: colors.accent + "35" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.md, paddingVertical: 14,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { padding: 4 },
  backArrow: { fontFamily: fonts.sans, fontSize: 20, color: colors.text, lineHeight: 24 },
  pageTitle: {
    fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 3,
    color: colors.accent, textTransform: "uppercase",
  },
  pricingBtn: {
    borderWidth: 1, borderColor: colors.accentBorder,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 3, backgroundColor: colors.accentMuted,
  },
  pricingBtnText: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.6, color: colors.accent, textTransform: "uppercase" },

  // Error
  errorBlock: { padding: space.xl, alignItems: "center", gap: 12, marginTop: space.xl },
  errorIcon: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerMuted,
    alignItems: "center", justifyContent: "center",
  },
  errorIconText: { fontFamily: fonts.sansMedium, fontSize: 20, color: colors.danger, lineHeight: 24 },
  errorLabel: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.8, color: colors.danger, textTransform: "uppercase" },
  errorSub: { fontFamily: fonts.sans, fontSize: 15, color: colors.textSecondary },
  retryBtn: {
    borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentMuted,
    paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.xs, marginTop: 4,
  },
  retryText: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.8, color: colors.accent, textTransform: "uppercase" },

  // Alerts
  alertsBlock: { paddingHorizontal: space.md, paddingTop: space.sm, gap: 6 },
  alertRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.sm, overflow: "hidden" },
  alertStripe: { width: 3, alignSelf: "stretch" },
  alertText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, flex: 1, paddingHorizontal: 12, paddingVertical: 10 },

  // Hero
  heroBlock: { paddingHorizontal: space.lg, paddingTop: space.xl + 4, paddingBottom: space.lg },
  heroLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2.4,
    color: colors.textSecondary, textTransform: "uppercase", marginBottom: 10,
  },
  heroCost: {
    fontFamily: fonts.sans, fontSize: 68, fontWeight: "300",
    letterSpacing: -4, lineHeight: 68, marginBottom: 18,
  },
  heroRow: { flexDirection: "row", gap: 8 },
  heroChip: {
    flex: 1, backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  heroChipLabel: {
    fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4,
    color: colors.textSecondary, textTransform: "uppercase", marginBottom: 5,
  },
  heroChipVal: { fontFamily: fonts.mono, fontSize: 14, color: colors.text, letterSpacing: -0.2 },

  // Section
  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, marginBottom: 2, marginTop: space.md, gap: 10 },
  sectionLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2.0,
    color: colors.textSecondary, textTransform: "uppercase", flexShrink: 0,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Model bars
  modelBlock: {
    marginHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, overflow: "hidden", marginBottom: space.sm,
  },
  modelRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingVertical: 14, gap: 10 },
  modelRowTop: { backgroundColor: colors.surfaceRaised },
  modelLeft: { flexDirection: "row", alignItems: "center", gap: 7, width: 130 },
  providerDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  modelName: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.2, flex: 1 },
  barWrap: { flex: 1 },
  barTrack: { height: 5, backgroundColor: colors.border, borderRadius: 2.5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2.5 },
  modelCost: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary, width: 64, textAlign: "right" },

  // Efficiency
  efficiencyBlock: {
    marginHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, padding: space.md, gap: 14, marginBottom: space.sm,
  },
  effRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  effLabel: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.4, color: colors.textSecondary, textTransform: "uppercase" },
  effValue: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
  effBarTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden", marginTop: -6 },
  effBarFill: { height: "100%", borderRadius: 2 },

  emptyModel: { padding: space.xl, alignItems: "center" },
  emptyModelText: { fontFamily: fonts.sans, fontSize: 15, color: colors.textSecondary },
});

const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.90)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    maxHeight: "88%",
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.accentBorder,
  },
  handle: { width: 36, height: 4, backgroundColor: colors.borderStrong, alignSelf: "center", marginTop: 12, marginBottom: 4, borderRadius: 2 },
  sheetHead: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  sheetTitle: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2.0, color: colors.accent, textTransform: "uppercase" },
  sheetSub: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  closeBtn: { padding: 4 },
  closeX: { fontFamily: fonts.sans, fontSize: 18, color: colors.textSecondary, lineHeight: 22 },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: space.md, marginBottom: space.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.sm, backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 6,
  },
  searchIcon: { fontFamily: fonts.mono, fontSize: 16, color: colors.textSecondary },
  searchInput: { flex: 1, fontFamily: fonts.mono, fontSize: 13, color: colors.text },
  searchClear: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },

  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: space.lg },
  tableHead: {
    flexDirection: "row", paddingHorizontal: space.lg, paddingVertical: 10,
    backgroundColor: colors.surfaceRaised,
  },
  headCell: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4, color: colors.textSecondary, textTransform: "uppercase" },
  providerHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: space.lg, paddingVertical: 9,
    backgroundColor: colors.bg,
    borderLeftWidth: 3, marginTop: 2,
  },
  providerDotLg: { width: 8, height: 8, borderRadius: 4 },
  providerDot: { width: 5, height: 5, borderRadius: 2.5, flexShrink: 0 },
  providerLabel: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", flex: 1 },
  providerCount: { fontFamily: fonts.mono, fontSize: 10, color: colors.textTertiary },
  tableRow: { flexDirection: "row", paddingHorizontal: space.lg, paddingVertical: 12, alignItems: "center" },
  modelName: { fontFamily: fonts.mono, fontSize: 12, color: colors.text, flex: 1 },
  priceCell: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  noteCell: { fontFamily: fonts.mono, fontSize: 11, color: colors.warning },
  emptySearch: { padding: space.xl, alignItems: "center" },
  emptySearchText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },
});
