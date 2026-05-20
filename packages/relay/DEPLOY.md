# AgentPilot Relay Server

Lightweight Bun WebSocket relay that bridges AI coding agents (daemon) to mobile phones with zero-configuration session routing.

## What it does

- Accepts WebSocket connections from **phones** (Expo app) and **daemons** (laptop agent interceptors)
- Routes messages by UUID session — isolated, secure, ephemeral
- Forwards token events phone←daemon and commands phone→daemon
- Auto-cleans disconnected sessions after 5 minutes
- Rate-limits messages to 100/sec per peer
- Health endpoint for monitoring

## Running locally

```bash
bun install
bun run dev        # ws://localhost:8082
```

Health check:
```bash
curl http://localhost:8082/health
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8082` | HTTP + WebSocket listen port |

## WebSocket protocol

### Connection

Both peers connect with query params:

```
ws://relay.example.com?session=<uuid>&role=<phone|daemon>
```

### Messages

All messages are JSON:

```typescript
interface RelayMessage {
  type: "tokens" | "command" | "status" | "error" | "ping" | "pong" | "peer_connected" | "peer_disconnected";
  payload: unknown;
  timestamp: number;
  id?: string;
}
```

**Daemon → Phone**
```json
{
  "type": "tokens",
  "payload": {
    "model": "claude-sonnet-4-5",
    "inputTokens": 2000,
    "outputTokens": 800,
    "costUsd": 0.012
  },
  "timestamp": 1779297615000
}
```

**Phone → Daemon**
```json
{
  "type": "command",
  "payload": {
    "action": "pause",
    "params": {}
  },
  "timestamp": 1779297615000
}
```

## Deployment guides

### Fly.io

Create `fly.toml`:

```toml
app = "agentpilot-relay"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8082"

[[services]]
  internal_port = 8082
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

Create `Dockerfile`:

```dockerfile
FROM oven/bun:1.2-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY src ./src
EXPOSE 8082
CMD ["bun", "src/relay.ts"]
```

Deploy:
```bash
fly deploy
```

### Railway

Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "bun src/relay.ts",
    "healthcheckPath": "/health",
    "healthcheckPort": 8082,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

Push to GitHub, connect Railway repo, deploy.

### Self-hosted (systemd)

Create `/etc/systemd/system/agentpilot-relay.service`:

```ini
[Unit]
Description=AgentPilot Relay Server
After=network.target

[Service]
Type=simple
User=agentpilot
WorkingDirectory=/opt/agentpilot-relay
ExecStart=/usr/local/bin/bun src/relay.ts
Restart=always
RestartSec=5
Environment=PORT=8082

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable agentpilot-relay
sudo systemctl start agentpilot-relay
```

### Docker Compose

```yaml
services:
  relay:
    build: .
    ports:
      - "8082:8082"
    environment:
      - PORT=8082
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8082/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Security considerations

- Session IDs are UUID v4 — unguessable, ephemeral
- No auth layer by design (MVP) — deploy behind VPN or add JWT middleware for production
- Rate limiting: 100 msg/sec per peer
- No persistent storage in relay — all session state is in-memory
- Auto-cleanup: sessions expire 5 minutes after both peers disconnect

## Monitoring

Health endpoint returns:
```json
{
  "status": "ok",
  "sessions": 12,
  "phones": 8,
  "daemons": 10
}
```

Logs include connection events, message forwarding, rate-limit hits, and cleanup.

## Architecture

```
Phone (Expo) ──WebSocket──► Relay (Bun) ◄──WebSocket── Daemon (Bun)
                                    │
                                    └── SessionManager
                                        ├── registerPeer()
                                        ├── forwardMessage()
                                        ├── removePeer()
                                        └── cleanup()
```

- `relay.ts` — HTTP fetch handler + WebSocket event handlers
- `session.ts` — SessionManager with routing, rate limiting, cleanup timer
- `types.ts` — Shared message type definitions
