# mafa-daemon

Control any AI coding agent from your phone. Live token spend, tool calls, pause/kill/inject — all streamed to the MAFA mobile app.

## Supported agents (auto-detected)

| Agent | Command |
|-------|---------|
| Claude Code | `claude` |
| Codex CLI | `codex` |
| Aider | `aider` |
| Gemini CLI | `gemini` |
| OpenCode | `opencode` |
| GitHub Copilot CLI | `gh copilot` |
| Cline | `cline` |
| Hermes Agent | `hermes` |
| OpenClaw | `openclaw` |
| **Any agent** | auto-detected via process tree + stdout parsing |

## Install

```bash
npm install -g mafa-daemon
# or
bun add -g mafa-daemon
```

## Usage

### 🚀 Shell integration (recommended — zero-friction)

Set it up once, then just type agent commands normally:

```bash
# bash/zsh
echo 'eval "$(mafa init)"' >> ~/.zshrc

# PowerShell
mafa init-powershell | Add-Content $PROFILE
```

Then daily:

```bash
mafa pair          # scan QR from phone — session auto-saves
claude "fix this"  # just works
opencode "refactor" # just works
```

### Manual wrap mode

```bash
mafa run -s <session-uuid> -- claude "fix my tests"
mafa run -s <session-uuid> -- aider --model claude-3-5-sonnet-20241022
```

### Attach mode (already-running agent)

```bash
mafa attach -s <session-uuid>
```

### Detect only

```bash
mafa detect
```

## Options

```
-r, --relay <url>      Relay WebSocket URL (default: ws://localhost:8080)
-v, --verbose          Verbose logging
--restart              Auto-restart child on non-zero exit (experimental)
```

## How it works

1. **Wrap mode**: spawns your agent as a child process, pipes stdin/stdout/stderr
2. **stdout parser**: regex patterns extract model name, tool calls, token counts from agent output
3. **Config reader**: reads `.claude/settings.json`, `.aider.conf`, `codex.yaml` etc to detect model
4. **Fetch interceptor**: monkey-patches `globalThis.fetch` to capture Anthropic/OpenAI/Gemini API responses
5. **Relay**: streams everything over WebSocket to your phone in real-time
6. **Commands**: phone can pause (SIGSTOP), resume (SIGCONT), kill (SIGTERM), inject text to stdin

## Phone controls

| Action | What it does |
|--------|-------------|
| Pause | Sends SIGSTOP to agent process |
| Resume | Sends SIGCONT |
| Kill | Sends SIGTERM → SIGKILL |
| Inject | Writes text to agent stdin |
| /compact | Sends `/compact` to agent stdin |
| Switch model | Sends `/model <name>` to agent stdin |

## Environment variables

```bash
MAFA_RELAY=wss://your-relay.com  # override relay URL globally
ANTHROPIC_MODEL=claude-opus-4-5        # override detected model
```
