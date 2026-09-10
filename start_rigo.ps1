<#
.SYNOPSIS
    Arranque integral del sistema RIGO (Ollama + Backend FastAPI + Frontend Vite)
.NOTES
    Requiere: PowerShell 5.1+, Python 3.11+, pnpm, Ollama instalado y en PATH
#>

param(
    [switch]$NoOllamaCheck,
    [switch]$SkipBackendInstall,
    [switch]$SkipFrontendInstall
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendDir = Join-Path $scriptDir "backend"
$frontendDir = Join-Path $backendDir "frontend"
$venvDir = Join-Path $backendDir ".venv"
$jobs = @()

function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$msg) Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "[ERR]  $msg" -ForegroundColor Red }

function Stop-Jobs {
    Write-Info "Deteniendo jobs en segundo plano..."
    foreach ($job in $jobs) {
        if ($job.State -eq 'Running') {
            Stop-Job $job -Force
            Write-Info "Job detenido: $($job.Name)"
        }
    }
    Get-Job | Remove-Job -Force
}

trap { Stop-Jobs; exit 1 }

# 1) Verificar Ollama
if (-not $NoOllamaCheck) {
    Write-Info "Verificando Ollama..."
    try {
        $ollamaCheck = ollama list 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Ollama no responde. ¿Está corriendo 'ollama serve'?"
            Write-Warn "Usa -NoOllamaCheck para saltar esta verificación."
            exit 1
        }
        Write-Ok "Ollama disponible"
        $ollamaCheck | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    } catch {
        Write-Err "Ollama no encontrado en PATH. Instálalo desde https://ollama.com"
        exit 1
    }
}

# 2) Levantar Backend
$backendJob = Start-Job -Name "RIGO-Backend" -WorkingDirectory $backendDir -ScriptBlock {
    param($venvDir, $skipInstall)
    $ErrorActionPreference = "Stop"
    try {
        if (-not $skipInstall) {
            if (-not (Test-Path $venvDir)) {
                Write-Host "[BACKEND] Creando venv..." -ForegroundColor Cyan
                python -m venv $venvDir
            }
            Write-Host "[BACKEND] Instalando dependencias..." -ForegroundColor Cyan
            & "$venvDir\Scripts\pip.exe" install -r requirements.txt
        }
        Write-Host "[BACKEND] Iniciando uvicorn en 0.0.0.0:8000..." -ForegroundColor Green
        & "$venvDir\Scripts\uvicorn.exe" app.main:app --host 0.0.0.0 --port 8000 --reload
    } catch {
        Write-Host "[BACKEND] ERROR: $($_.Exception.Message)" -ForegroundColor Red
        throw $_
    }
} -ArgumentList $venvDir, $SkipBackendInstall
$jobs += $backendJob

# 3) Levantar Frontend
$frontendJob = Start-Job -Name "RIGO-Frontend" -WorkingDirectory $frontendDir -ScriptBlock {
    param($skipInstall)
    $ErrorActionPreference = "Stop"
    try {
        if (-not $skipInstall) {
            Write-Host "[FRONTEND] Instalando dependencias (pnpm)..." -ForegroundColor Cyan
            pnpm install
        }
        Write-Host "[FRONTEND] Iniciando Vite dev server en 0.0.0.0:4952..." -ForegroundColor Green
        pnpm run dev --host
    } catch {
        Write-Host "[FRONTEND] ERROR: $($_.Exception.Message)" -ForegroundColor Red
        throw $_
    }
} -ArgumentList $SkipFrontendInstall
$jobs += $frontendJob

# 4) Esperar a que estén listos y mostrar URLs
Write-Info "Esperando a que los servicios inicien..."
Start-Sleep -Seconds 3

$backendReady = $false
$frontendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    if (-not $backendReady) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) { $backendReady = $true; Write-Ok "Backend listo en http://localhost:8000" }
        } catch { }
    }
    if (-not $frontendReady) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:4952" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) { $frontendReady = $true; Write-Ok "Frontend listo en http://localhost:4952" }
        } catch { }
    }
    if ($backendReady -and $frontendReady) { break }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  RIGO — Asistente Bibliográfico Inteligente (UNA Piura)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API : http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Health Check: http://localhost:8000/health" -ForegroundColor Cyan
Write-Host "  API Docs    : http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend    : http://localhost:4952" -ForegroundColor Cyan
Write-Host "  Kiosco      : http://localhost:4952/kiosk" -ForegroundColor Cyan
Write-Host "  Admin       : http://localhost:4952/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener todos los servicios" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green

# Mantener script vivo hasta Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 5
        # Verificar que los jobs siguen vivos
        $deadJobs = $jobs | Where-Object { $_.State -eq 'Failed' }
        if ($deadJobs) {
            foreach ($dj in $deadJobs) {
                Write-Err "Job $($dj.Name) falló:"
                Receive-Job $dj | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
            }
            Stop-Jobs
            exit 1
        }
    }
} finally {
    Stop-Jobs
}
