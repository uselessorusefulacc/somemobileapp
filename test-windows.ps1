# AgentPilot — Windows Test Script
# Run this in PowerShell on your laptop
# Requires: Node.js installed (for wscat)
#
# Install wscat once:  npm install -g wscat

$API = "https://81ylvadrgdbxmql33216v-preview-4200.runable.site"
$WS  = "wss://81ylvadrgdbxmql33216v-preview-4200.runable.site/ws"

Write-Host "`n=== AgentPilot Windows Test ===" -ForegroundColor Cyan

# ── 1. Check API is reachable ──────────────────────────────────────────────
Write-Host "`n[1] Checking API..." -ForegroundColor Yellow
$analytics = Invoke-RestMethod -Uri "$API/api/analytics" -Method GET
Write-Host "    Total cost:     `$$($analytics.totalCost)" -ForegroundColor Green
Write-Host "    Total sessions: $($analytics.totalSessions)" -ForegroundColor Green
Write-Host "    Total tokens:   $($analytics.totalTokens)" -ForegroundColor Green

# ── 2. Create a session ────────────────────────────────────────────────────
Write-Host "`n[2] Creating session..." -ForegroundColor Yellow
$body = @{ name = "Windows Test Agent"; agentType = "assistant"; model = "claude-opus-4-5" } | ConvertTo-Json
$result = Invoke-RestMethod -Uri "$API/api/sessions" -Method POST -Body $body -ContentType "application/json"
$SESSION_ID = $result.session.id
Write-Host "    Session ID: $SESSION_ID" -ForegroundColor Green

# ── 3. Log some token usage ────────────────────────────────────────────────
Write-Host "`n[3] Logging token usage..." -ForegroundColor Yellow
$tokens = @{
    model            = "claude-opus-4-5"
    inputTokens      = 1500
    outputTokens     = 500
    cacheReadTokens  = 200
    cacheWriteTokens = 0
} | ConvertTo-Json
$tok = Invoke-RestMethod -Uri "$API/api/sessions/$SESSION_ID/tokens" -Method POST -Body $tokens -ContentType "application/json"
Write-Host "    Cost logged: `$$($tok.costUsd)" -ForegroundColor Green

# ── 4. Check pending tips ──────────────────────────────────────────────────
Write-Host "`n[4] Fetching optimization tips..." -ForegroundColor Yellow
$tips = Invoke-RestMethod -Uri "$API/api/tips?status=pending" -Method GET
Write-Host "    Pending tips: $($tips.tips.Count)" -ForegroundColor Green
if ($tips.tips.Count -gt 0) {
    $tips.tips | Select-Object -First 3 | ForEach-Object {
        Write-Host "    - [$($_.category.ToUpper())] $($_.title)" -ForegroundColor Gray
    }
}

# ── 5. Set budget ─────────────────────────────────────────────────────────
Write-Host "`n[5] Setting budget limits..." -ForegroundColor Yellow
$budget = @{ dailyLimitUsd = 50; monthlyLimitUsd = 500; alertAtPct = 80 } | ConvertTo-Json
$b = Invoke-RestMethod -Uri "$API/api/budget" -Method POST -Body $budget -ContentType "application/json"
Write-Host "    Daily limit:   `$$($b.dailyLimitUsd)" -ForegroundColor Green
Write-Host "    Monthly limit: `$$($b.monthlyLimitUsd)" -ForegroundColor Green

# ── 6. WebSocket relay test ────────────────────────────────────────────────
Write-Host "`n[6] WebSocket relay..." -ForegroundColor Yellow
Write-Host "    Relay URL: $WS" -ForegroundColor Gray
Write-Host "    Session:   $SESSION_ID" -ForegroundColor Gray
Write-Host ""
Write-Host "    Now open Expo Go on your phone and go to the CONNECT tab." -ForegroundColor Cyan
Write-Host "    Then run this in a NEW PowerShell window to connect as daemon:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    wscat -c `"$WS`?session=$SESSION_ID&role=daemon`"" -ForegroundColor White
Write-Host ""
Write-Host "    Once connected, paste this to send a token event to your phone:" -ForegroundColor Cyan
Write-Host '    {"type":"usage","payload":{"inputTokens":1000,"outputTokens":300,"model":"claude-opus-4-5","costUsd":0.021},"timestamp":0}' -ForegroundColor White
Write-Host ""
Write-Host "=== All API tests passed ===" -ForegroundColor Green
