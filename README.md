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

### One-time shell setup

**bash/zsh (Linux, macOS):**
```bash
echo 'eval "$(mafa init)"' >> ~/.zshrc
```

**PowerShell (Windows):**
```powershell
mafa init-powershell | Add-Content $PROFILE
```

This creates wrapper functions for `claude`, `codex`, `gemini`, `opencode` that auto-track through MAFA whenever you run them.

### Daily use — 2 steps

**Step 1 — Pair your phone:**
```bash
mafa pair
```
Prints a QR code — scan it with the MAFA app on your phone. The session auto-saves to `~/.mafa/active-session`.

**Step 2 — Run your agent normally:**
```bash
claude "fix my tests"
# or
opencode "refactor this"
# or
gemini "write a unit test"
```

That's it. MAFA intercepts every LLM call and streams cost, tokens, and tool usage to your phone live.

> No `-s <uuid>`, no `--`, no wrapping commands manually. Just type what you'd normally type.

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
mafa [command]

Commands:
  pair              Create session, print QR, auto-save for shell integration
  run               Wrap and monitor an agent command (advanced/manual use)
  attach            Auto-detect a running agent and monitor it
  init              Print bash/zsh integration script
  init-powershell   Print PowerShell integration script
  activate <uuid>   Set active session for auto-tracking
  deactivate        Clear active session
  detect            Scan for running agents
```

**The daemon intercepts every LLM API call your agent makes** — no code changes required.

### Shell integration (recommended)

```bash
# bash/zsh
eval "$(mafa init)"    # then add to ~/.bashrc

# PowerShell
mafa init-powershell | Add-Content $PROFILE   # then reload $PROFILE
```

Once set up, any `claude`, `codex`, `gemini`, or `opencode` command is automatically wrapped with the active session. Run `mafa pair` → scan QR → then just type agent commands normally.

### Manual usage

```bash
# With shell integration, just activate a session:
mafa activate <uuid>

# Or specify inline (no shell integration needed):
mafa run -s <uuid> -- claude "fix my tests"

# Use a different relay:
mafa run -s <uuid> -r ws://my-relay.fly.dev -- claude "fix my tests"
```

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

# Start the relay
cd packages/relay && bun run dev

# Start the mobile app (Expo)
cd packages/mobile && bun run dev

# Build & test the daemon
cd packages/daemon && bun test && bun run typecheck
```

## Type checking

```bash
cd packages/relay && bun run typecheck   # clean
cd packages/daemon && bun run typecheck  # clean
cd packages/mobile && bun run typecheck  # clean
cd packages/api && bun run typecheck     # known issues
```

## Running tests

```bash
cd packages/daemon && bun test     # 54+ tests
cd packages/web && bun test        # 4+ tests
```

## Why it matters

AI coding agents can rack up hundreds of dollars in API costs silently. MAFA:

1. **Makes costs visible** — real-time, not at end-of-month billing shock
2. **Prevents overruns** — budget caps with proactive alerts
3. **Guides optimization** — context warnings before runaway spending, model switch suggestions where savings are 90%+
4. **Works anywhere** — WebSocket relay means your phone sees live data even when your laptop is on a different network (with relay deployed to the cloud)

Built for the Runable Hackathon 2026.
