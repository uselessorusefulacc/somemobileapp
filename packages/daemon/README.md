# AgentPilot Daemon

Zero-code agent interceptor. Monkey-patches `global.fetch()` to capture LLM API usage and stream it live to your phone via the AgentPilot relay.

## Supported APIs

- **OpenAI** (`api.openai.com`) — GPT-4o, GPT-4o-mini, o3-mini
- **Anthropic** (`api.anthropic.com`) — Claude Opus, Sonnet, Haiku
- **Gemini** (`generativelanguage.googleapis.com`) — Gemini Pro, Flash

## Usage

```bash
# Via npx (when published)
npx @agentpilot/daemon --session <uuid>

# Local development
bun run dev --session <uuid>
```

## Options

```
-s, --session <uuid>  Session ID to pair with mobile app (required)
-r, --relay <url>     Relay server URL (default: ws://localhost:8082)
-v, --verbose         Enable verbose logging
```

## How it works

1. Connects to the relay WebSocket with your session UUID
2. Wraps `global.fetch` to intercept LLM API responses
3. Extracts token usage from response headers/body
4. Calculates cost using live pricing tables
5. Sends `tokens` messages to relay → forwarded to your phone
6. Listens for `command` messages from phone → logs to stdout

## Example output

```
[Daemon] Connecting to relay: ws://localhost:8082?session=...&role=daemon
[Daemon] Connected to relay
[Intercept] POST https://api.anthropic.com/v1/messages → 1500 in / 600 out / $0.009
[Intercept] POST https://api.openai.com/v1/chat/completions → 800 in / 400 out / $0.003
[Daemon] Phone connected
[Daemon] Received command: pause
```

## Development

```bash
bun install
bun run typecheck   # strict TypeScript, no any
```

## Files

- `daemon.ts` — CLI entry point, argument parsing, lifecycle
- `interceptor.ts` — `fetch` monkey-patch, usage extraction, cost calculation
- `relay-client.ts` — WebSocket client with reconnect + heartbeat
- `types.ts` — Shared type definitions
