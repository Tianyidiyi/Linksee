param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$ComposeFile = "infra/docker/docker-compose.dev.yml",
    [string]$EnvFile = "infra/docker/.env",
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

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

$rootPassword = Get-EnvValue -File $EnvFile -Key "MYSQL_ROOT_PASSWORD"

Write-Host "[1/4] Ensuring mysql container is running..."
docker compose -f $ComposeFile --env-file $EnvFile up -d mysql | Out-Null

Write-Host "[2/4] Dropping and recreating database '$Database'..."
docker exec $ContainerName sh -c "mysql -uroot -p$rootPassword -e 'DROP DATABASE IF EXISTS $Database; CREATE DATABASE $Database;'"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to recreate database '$Database'."
}

Write-Host "[3/4] Restoring backup from '$BackupFile'..."
Get-Content -Path $BackupFile -Raw | docker exec -i $ContainerName sh -c "mysql -uroot -p$rootPassword"
if ($LASTEXITCODE -ne 0) {
    throw "Restore failed."
}

Write-Host "[4/4] Restore completed successfully."
