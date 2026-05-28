import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

const MAFA_DIR = join(homedir(), ".mafa");
const SESSION_FILE = join(MAFA_DIR, "active-session");

export function getSessionFile(): string {
  return SESSION_FILE;
}

export async function readActiveSession(): Promise<string | null> {
  try {
    const raw = await readFile(SESSION_FILE, "utf8");
    const id = raw.trim();
    return id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function writeActiveSession(sessionId: string): Promise<void> {
  await mkdir(MAFA_DIR, { recursive: true });
  await writeFile(SESSION_FILE, sessionId.trim(), "utf8");
}

export async function clearActiveSession(): Promise<void> {
  try {
    await writeFile(SESSION_FILE, "", "utf8");
  } catch {
    // file may not exist — that's fine
  }
}

export function generatePowershellInitScript(): string {
  const psPath = SESSION_FILE;
  return `<#
.SYNOPSIS
    MAFA PowerShell integration — auto-track agent commands from any terminal
.DESCRIPTION
    Add to your PowerShell profile:
      mafa init-powershell | Add-Content $PROFILE
    
    Then just type claude/codex/gemini/opencode normally.
    No more copying session UUIDs or wrapping every command manually.
#>

$script:mafaSessionFile = "${psPath}"

# Resolve real command paths once (avoids recursion)
$script:mafaRealPaths = @{}
@("claude","codex","gemini","opencode") | ForEach-Object {
  $cmd = Get-Command $_ -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { $script:mafaRealPaths[$_] = $cmd.Source }
}

function global:claude {
  if (Test-Path $script:mafaSessionFile) {
    $sid = (Get-Content $script:mafaSessionFile -Raw).Trim()
    if ($sid) { return mafa run -s $sid -- claude @args }
  }
  if ($script:mafaRealPaths["claude"]) { & $script:mafaRealPaths["claude"] @args }
  else { throw "claude not found — install it or add its location to PATH" }
}
function global:codex {
  if (Test-Path $script:mafaSessionFile) {
    $sid = (Get-Content $script:mafaSessionFile -Raw).Trim()
    if ($sid) { return mafa run -s $sid -- codex @args }
  }
  if ($script:mafaRealPaths["codex"]) { & $script:mafaRealPaths["codex"] @args }
  else { throw "codex not found" }
}
function global:gemini {
  if (Test-Path $script:mafaSessionFile) {
    $sid = (Get-Content $script:mafaSessionFile -Raw).Trim()
    if ($sid) { return mafa run -s $sid -- gemini @args }
  }
  if ($script:mafaRealPaths["gemini"]) { & $script:mafaRealPaths["gemini"] @args }
  else { throw "gemini not found" }
}
function global:opencode {
  if (Test-Path $script:mafaSessionFile) {
    $sid = (Get-Content $script:mafaSessionFile -Raw).Trim()
    if ($sid) { return mafa run -s $sid -- opencode @args }
  }
  if ($script:mafaRealPaths["opencode"]) { & $script:mafaRealPaths["opencode"] @args }
  else { throw "opencode not found" }
}
`;
}

export function generateInitScript(): string {
  // Use POSIX-style path for cross-shell compatibility (bash/zsh on any OS)
  const posixPath = SESSION_FILE.replace(/\\/g, "/");
  return `# MAFA shell integration — make AI agent commands auto-track with your phone
# Add this to your ~/.bashrc or ~/.zshrc:
#   eval "$(mafa init)"
#
# Then just type claude/codex/gemini/opencode normally.
# No more copying session UUIDs or wrapping every command manually.

_MAFA_SESSION_FILE="${posixPath}"

_mafa_run() {
  if [ -f "$_MAFA_SESSION_FILE" ]; then
    _sid=$(cat "$_MAFA_SESSION_FILE" 2>/dev/null)
    if [ -n "$_sid" ]; then
      mafa run -s "$_sid" -- "$@"
      return $?
    fi
  fi
  command "$@"
}

# Override agent commands — add more as needed
claude()   { _mafa_run claude "$@"; }
codex()    { _mafa_run codex "$@"; }
gemini()   { _mafa_run gemini "$@"; }
opencode() { _mafa_run opencode "$@"; }
`;
}
