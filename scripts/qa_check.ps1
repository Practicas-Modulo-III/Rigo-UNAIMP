param(
  [string]$BaseUrl = 'http://127.0.0.1:8000',
  [switch]$ExpectLocalMode
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$health = (curl.exe -fsS "$base/health") | ConvertFrom-Json

# Test 7: both modes must expose nomic-embed-text's 768-dimensional space.
if ($health.embed_dimensions -ne 768) {
  throw "Test 7 failed: expected embed_dimensions=768, got $($health.embed_dimensions)."
}
Write-Host 'Test 7 OK: embed_dimensions=768.' -ForegroundColor Green

# Test 6: run this after starting the backend with MODO_DEMO_CLOUD=false.
if ($ExpectLocalMode) {
  if ($health.mode -ne 'on-premise' -or $health.llm_provider -ne 'ollama') {
    throw "Test 6 failed: expected on-premise/Ollama, got mode=$($health.mode), provider=$($health.llm_provider)."
  }
  Write-Host 'Test 6 OK: MODO_DEMO_CLOUD=false selects Ollama.' -ForegroundColor Green
} else {
  Write-Host 'Test 6 pending: rerun with -ExpectLocalMode after setting MODO_DEMO_CLOUD=false and restarting backend.' -ForegroundColor Yellow
}

# Test 1: first event: token must arrive in less than one second in cloud/Groq mode.
# Payload is written to a temp file and sent via curl's @file syntax because PowerShell 5.1
# mangles embedded double quotes when a JSON string is passed inline as a native-exe argument.
$payloadFile = Join-Path $env:TEMP 'rigo_qa_payload.json'
[System.IO.File]::WriteAllText($payloadFile, '{"question":"¿dónde está Giotto?","filters":{"category":"Todas","pasillo":"Todos","year_start":1900,"year_end":2030}}', [System.Text.UTF8Encoding]::new($false))
$watch = [System.Diagnostics.Stopwatch]::StartNew()
$firstTokenMilliseconds = $null
& curl.exe --no-buffer -sS -N --max-time 30 -X POST "$base/api/chat/stream" -H 'Accept: text/event-stream' -H 'Content-Type: application/json' --data "@$payloadFile" |
  ForEach-Object {
    if ($_ -eq 'event: token' -and $null -eq $firstTokenMilliseconds) {
      $firstTokenMilliseconds = $watch.ElapsedMilliseconds
    }
  }
$watch.Stop()
if ($null -eq $firstTokenMilliseconds) { throw 'Test 1 failed: no event: token received.' }
Write-Host "Test 1 first token: $firstTokenMilliseconds ms" -ForegroundColor Cyan
if ($health.mode -eq 'cloud' -and $firstTokenMilliseconds -ge 1000) {
  throw "Test 1 failed: cloud first token must be < 1000 ms; got $firstTokenMilliseconds ms."
}
Write-Host 'Test 1 OK.' -ForegroundColor Green
