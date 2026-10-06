$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$pythonCandidates = @(
    (Join-Path $PSScriptRoot "venv\Scripts\python.exe"),
    (Join-Path $PSScriptRoot ".venv\Scripts\python.exe")
)
$pythonPath = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $pythonPath) {
    throw "Backend virtual environment not found. Create backend\venv or backend\.venv first."
}

& $pythonPath -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000