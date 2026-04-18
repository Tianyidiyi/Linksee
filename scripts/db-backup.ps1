param(
    [string]$ComposeFile = "infra/docker/docker-compose.dev.yml",
    [string]$EnvFile = "infra/docker/.env",
    [string]$OutputDir = "backups",
    [string]$ContainerName = "collab-mysql",
    [string]$Database = "collab"
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
    param(
        [string]$File,
        [string]$Key
    )

    if (-not (Test-Path $File)) {
        throw "Env file not found: $File"
    }

    $line = Get-Content $File | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
    if (-not $line) {
        throw "Missing key '$Key' in env file: $File"
    }

    return ($line -split "=", 2)[1]
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker command not found. Please install Docker Desktop first."
}

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$rootPassword = Get-EnvValue -File $EnvFile -Key "MYSQL_ROOT_PASSWORD"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $OutputDir ("mysql_{0}_{1}.sql" -f $Database, $timestamp)

Write-Host "[1/3] Ensuring mysql container is running..."
docker compose -f $ComposeFile --env-file $EnvFile up -d mysql | Out-Null

Write-Host "[2/3] Creating backup: $outputFile"
$dumpCommand = "mysqldump -uroot -p$rootPassword --databases $Database"

$raw = docker exec $ContainerName sh -c $dumpCommand
if ($LASTEXITCODE -ne 0) {
    throw "mysqldump failed."
}

$raw | Out-File -FilePath $outputFile -Encoding utf8

Write-Host "[3/3] Backup completed."
Write-Host "Backup file: $outputFile"
