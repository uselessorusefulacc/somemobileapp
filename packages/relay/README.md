# AgentPilot Relay Server

Lightweight WebSocket message router that pairs a mobile phone with an agent daemon by session ID.

## Run locally

```bash
cd packages/relay
bun install
bun run dev
```

Server will start on `ws://localhost:8080`.

## Connection

Both clients connect to the same `session` (UUID v4) with different `role`:

```
Mobile app:  wss://relay.agentpilot.dev?session=UUID&role=phone
Agent daemon: wss://relay.agentpilot.dev?session=UUID&role=daemon
```

## Message Protocol

All messages are JSON:

```json
{
  "type": "tokens",
  "payload": { "model": "claude-sonnet-4-5", "inputTokens": 1000, "outputTokens": 500, "costUsd": 0.005 },
  "timestamp": 1716240000000
}
```

### Types

- `tokens` — daemon → phone (live token usage)
- `command` — phone → daemon (pause, compact, switch_model)
- `status` — bidirectional (agent state)
- `ping` / `pong` — keepalive
- `peer_connected` / `peer_disconnected` — system

## Test

```bash
bun run src/test-client.ts
```

## Deploy to Deno Deploy

```bash
deployctl deploy --include=src --project=agentpilot-relay
```

Or use the Dockerfile if running on a VPS.
