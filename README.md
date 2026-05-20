# AgentPilot — AI Cost Intelligence

> Real-time cost monitoring, optimization, and budget control for AI coding agents.

## What it does

AgentPilot gives developers full visibility into what their AI coding agents (Claude Code, OpenCode, Codex) are spending — token by token, session by session — and actively helps them cut costs.

### Core features

| Feature | Description |
|---------|-------------|
| **Live Dashboard** | Real-time spend meter with 10s auto-polling, active session cards |
| **Budget Caps** | Set monthly/daily limits — get warned at configurable threshold (default 80%) |
| **Context Warnings** | Yellow/red banners when session tokens exceed 3K/8K — prompts you to `/compact` |
| **Model Switch Tips** | Detects expensive models (Opus, o3) and suggests cheaper alternatives with savings % |
| **Cache Hit Rate** | Shows prompt cache efficiency — low rate triggers caching recommendations |
| **Monthly Projection** | Projects spend × 30, goes red when approaching budget |
| **Token Event Log** | Every LLM call logged: input/output/cache tokens, cost, timestamp |
| **Webhook API** | Agents POST to `/api/events` — drop-in integration for any LLM SDK |
| **Model Comparison** | Side-by-side cost of all models for your token usage |

## Tech stack

- **Mobile**: React Native + Expo (cross-platform iOS/Android/Web)
- **API**: Hono on Bun — type-safe with `hono/client`
- **DB**: SQLite via Drizzle ORM
- **UI**: Dark terminal aesthetic, SpaceMono font, no external UI libraries

## API endpoints

```
GET  /api/health                       # Liveness check
GET  /api/sessions                     # All sessions
POST /api/sessions                     # Create session
GET  /api/sessions/:id                 # Session detail
GET  /api/sessions/:id/events          # Token events
POST /api/sessions/:id/tokens          # Log token event
POST /api/sessions/:id/optimize        # Generate optimization tips
GET  /api/analytics                    # Aggregate stats + cache hit rate
GET  /api/budget                       # Current budget config
POST /api/budget                       # Update budget + alert threshold
GET  /api/alerts                       # Active budget alerts
POST /api/events                       # Webhook: agents report token usage
POST /api/compare-models               # Cost comparison across all models
POST /api/demo/seed                    # Seed demo data
```

## Agent integration

Paste this into your agent's cost reporting hook:

```bash
curl -X POST https://your-agentpilot-url/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id",
    "model": "claude-sonnet-4-5",
    "promptTokens": 2400,
    "completionTokens": 890
  }'
```

Or use the typed SDK from `packages/mobile/lib/api.ts` (Hono RPC client).

## Running locally

```bash
# Install
bun install

# Start API + web (port 4200)
bun run dev

# Start mobile (port 4300)
cd packages/mobile && bunx expo start --port 4300

# Seed demo data
curl -X POST http://localhost:4200/api/demo/seed
```

## Why it matters

AI coding agents can rack up hundreds of dollars in API costs silently. AgentPilot:

1. **Makes costs visible** — real-time, not at end-of-month billing shock
2. **Prevents overruns** — budget caps with proactive alerts
3. **Guides optimization** — context warnings before runaway spending, model switch suggestions where savings are 90%+
4. **Integrates in minutes** — single webhook endpoint, works with any LLM SDK

Built for the Runable Hackathon 2026.
