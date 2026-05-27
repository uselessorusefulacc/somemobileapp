# MAFA — AI Cost Intelligence

> Real-time cost monitoring, optimization, and budget control for AI coding agents.

## What it does

MAFA gives developers full visibility into what their AI coding agents (Claude Code, OpenCode, Codex) are spending — token by token, session by session — and actively helps them cut costs.

### Core features

| Feature | Description |
|---------|-------------|
| **Live Cockpit** | Real-time WebSocket dashboard: spend meter, burn rate, hourly projection, optimization tips |
| **Agent Daemon** | Zero-code `fetch` interceptor — drop it on any laptop running an agent, costs stream instantly to your phone |
| **Remote Commands** | Pause, compact context, or switch models directly from your phone |
| **Budget Caps** | Set monthly/daily limits — get warned at configurable threshold (default 80%) |
| **Context Warnings** | Yellow/red banners when session tokens exceed 50K/200K — prompts you to compact |
| **Model Switch Tips** | Detects expensive models (Opus, o3) and suggests cheaper alternatives with savings % |
| **Cache Hit Rate** | Shows prompt cache efficiency — low rate triggers caching recommendations |
| **Monthly Projection** | Projects spend × 30, goes red when approaching budget |
| **Token Event Log** | Every LLM call logged: input/output/cache tokens, cost, timestamp |
| **Model Comparison** | Side-by-side cost of all models for your token usage |

## Architecture

```
┌─────────────┐      WebSocket       ┌─────────────┐      WebSocket       ┌─────────────┐
│   Phone     │ ◄──────────────────► │    Relay    │ ◄──────────────────► │   Daemon    │
│  (Expo)     │    tokens/commands   │   (Bun)     │    tokens/commands   │  (Bun)      │
└─────────────┘                      └─────────────┘                      └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │   SQLite    │
                                       │  (Drizzle)  │
                                       └─────────────┘
```

## Tech stack

- **Mobile**: React Native 0.76 + Expo SDK 52, factory.ai-inspired dark glassmorphism UI
- **Relay**: Bun WebSocket server with session routing, rate limiting, auto-cleanup
- **Daemon**: Bun CLI with global `fetch` interceptor — supports OpenAI, Anthropic, Gemini
- **API**: Hono on Bun — SQLite via Drizzle ORM (fallback / legacy)
- **UI**: Custom design system, SpaceMono font, no external UI libraries

## Quick start

### 1. Start the relay server

```bash
cd packages/relay
bun install
bun run dev        # ws://localhost:8082
```

### 2. Start the mobile app

```bash
cd packages/mobile
bun install
bun run dev        # Expo development server
```

Open the Expo Go app on your phone and scan the QR code.

### 3. Connect your agent

In the mobile app, go to **Connect** → create a session → copy the daemon command.

On the laptop running your agent:

```bash
npx mafa-daemon --session <uuid>
```

Or run locally:

```bash
cd packages/daemon
bun run dev --session <uuid>
```

Your phone now receives live token events from every LLM call your agent makes.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `relay` | `packages/relay` | Bun WebSocket relay server |
| `daemon` | `packages/daemon` | Agent-side fetch interceptor & relay client |
| `mobile` | `packages/mobile` | Expo React Native app |
| `api` | `packages/api` | Hono REST API + SQLite (legacy fallback) |
| `web` | `packages/web` | Web dashboard (legacy) |

## Daemon CLI

```bash
npx mafa-daemon [options]

Options:
  -s, --session <uuid>  Session ID to pair with mobile
  -r, --relay <url>     Relay URL (default: ws://localhost:8082)
  -v, --verbose         Enable verbose logging
```

The daemon monkey-patches the global `fetch()` to intercept LLM API responses from OpenAI, Anthropic, and Gemini. No code changes in your agent required.

## Relay server

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8082` | WebSocket listen port |

Health check:

```bash
curl http://localhost:8082/health
# {"status":"ok","sessions":0,"phones":0,"daemons":0}
```

### Deploying the relay

The relay is a single Bun file. Deploy anywhere Bun runs:

**Fly.io**
```bash
cd packages/relay
fly deploy
```

**Railway**
```bash
cd packages/relay
railway up
```

**Self-hosted**
```bash
bun install -g pm2
pm2 start src/relay.ts --interpreter bun --name mafa-relay
```

## Development

```bash
# Root install
bun install

# Start all packages (root)
bun run dev

# Individual packages
cd packages/relay && bun run dev
cd packages/daemon && bun run dev --session <uuid>
cd packages/mobile && bun run dev
cd packages/api && bun run dev
```

## Type checking

```bash
cd packages/relay && bun run typecheck   # clean
cd packages/daemon && bun run typecheck  # clean
cd packages/mobile && bun run typecheck  # clean
cd packages/api && bun run typecheck     # known issues
```

## Why it matters

AI coding agents can rack up hundreds of dollars in API costs silently. MAFA:

1. **Makes costs visible** — real-time, not at end-of-month billing shock
2. **Prevents overruns** — budget caps with proactive alerts
3. **Guides optimization** — context warnings before runaway spending, model switch suggestions where savings are 90%+
4. **Works anywhere** — WebSocket relay means your phone sees live data even when your laptop is on a different network (with relay deployed to the cloud)

Built for the Runable Hackathon 2026.
