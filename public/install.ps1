# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Error: This script must be run as an administrator." -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
$nodeInstalled = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
$npmInstalled = $null -ne (Get-Command npm -ErrorAction SilentlyContinue)

if (-not $nodeInstalled) {
    Write-Host "Error: Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org"
    exit 1
}

if (-not $npmInstalled) {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    Write-Host "Please install npm and try again"
    exit 1
}

Write-Host "🚀 Installing Zephyrforge..." -ForegroundColor Cyan

# Create temporary directory
$tmpDir = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString()))
Set-Location $tmpDir

try {
    Write-Host "Running installer..." -ForegroundColor Green
    npx zephyr-forge@latest init
}
finally {
    # Cleanup
    Remove-Item -Path $tmpDir -Recurse -Force
}
