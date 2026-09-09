<#
.SYNOPSIS
  Prepara o PostgreSQL para o Sincro: cria o papel e o banco, alinha o
  DB_PASSWORD do .env e aplica as migrations.

.DESCRIPTION
  Existe para eliminar um erro silencioso: a senha do papel "sincro" precisa
  ser identica a DB_PASSWORD do .env. Quando divergem, a falha aparece la na
  frente como erro de autenticacao do migration:run, que nao diz que o
  problema e a senha do .env.

  E idempotente -- rodar duas vezes nao quebra nada.

.EXAMPLE
  .\scripts\setup-postgres.ps1
  # pede a senha do superusuario e gera uma senha para o papel sincro

.EXAMPLE
  $env:PGPASSWORD = "senha-do-superusuario"
  .\scripts\setup-postgres.ps1 -Porta 5432 -SenhaSincro "minha-senha"
#>
[CmdletBinding()]
param(
  [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin",
  [string]$Servidor = "localhost",
  [int]$Porta = 5432,
  [string]$Superusuario = "postgres",
  [string]$Papel = "sincro",
  [string]$Banco = "sincro",
  [string]$SenhaSincro,
  [switch]$PularMigrations
)

$ErrorActionPreference = "Stop"

$psql = Join-Path $PgBin "psql.exe"
if (-not (Test-Path $psql)) {
  throw "psql.exe nao encontrado em $PgBin. Passe -PgBin com o caminho correto."
}

# Senha do papel: recebida, ou gerada (nunca em branco -- scram-sha-256 recusa).
if (-not $SenhaSincro) {
  $bytes = New-Object byte[] 18
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $SenhaSincro = [Convert]::ToBase64String($bytes).Replace("+","-").Replace("/","_").Replace("=","")
  Write-Host "Senha gerada para o papel $Papel." -ForegroundColor Cyan
}

if (-not $env:PGPASSWORD) {
  $segura = Read-Host "Senha do superusuario '$Superusuario'" -AsSecureString
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))
}

function Invoke-Psql {
  param([string]$Sql, [string]$BancoAlvo = "postgres")
  $saida = & $psql -h $Servidor -p $Porta -U $Superusuario -d $BancoAlvo -t -A -c $Sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw "psql falhou: $saida" }
  return $saida
}

Write-Host "==> Conectando em ${Servidor}:${Porta} como $Superusuario"
Invoke-Psql "SELECT 1" | Out-Null

# --- papel ---------------------------------------------------------------
$senhaEscapada = $SenhaSincro.Replace("'", "''")
$existe = Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname = '$Papel'"
if ($existe -match "1") {
  Invoke-Psql "ALTER USER ""$Papel"" WITH PASSWORD '$senhaEscapada'" | Out-Null
  Write-Host "==> Papel $Papel ja existia; senha atualizada."
} else {
  Invoke-Psql "CREATE USER ""$Papel"" WITH PASSWORD '$senhaEscapada'" | Out-Null
  Write-Host "==> Papel $Papel criado."
}

# --- banco ---------------------------------------------------------------
$existeBanco = Invoke-Psql "SELECT 1 FROM pg_database WHERE datname = '$Banco'"
if ($existeBanco -match "1") {
  Write-Host "==> Banco $Banco ja existia."
} else {
  Invoke-Psql "CREATE DATABASE ""$Banco"" OWNER ""$Papel""" | Out-Null
  Write-Host "==> Banco $Banco criado."
}

# --- .env ----------------------------------------------------------------
$envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (Test-Path $envPath) {
  $linhas = Get-Content $envPath
  $novas = $linhas | ForEach-Object {
    if ($_ -match "^DB_PASSWORD=")  { "DB_PASSWORD=$SenhaSincro" }
    elseif ($_ -match "^DB_USER=")  { "DB_USER=$Papel" }
    elseif ($_ -match "^DB_NAME=")  { "DB_NAME=$Banco" }
    elseif ($_ -match "^DB_PORT=")  { "DB_PORT=$Porta" }
    else { $_ }
  }
  Set-Content -Path $envPath -Value $novas -Encoding UTF8
  Write-Host "==> .env alinhado (DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)."
} else {
  Write-Warning ".env nao encontrado. Copie de .env.example e defina DB_PASSWORD=$SenhaSincro"
}

# --- migrations ----------------------------------------------------------
if (-not $PularMigrations) {
  Write-Host "==> Aplicando migrations"
  Push-Location (Split-Path $PSScriptRoot -Parent)
  try { & npm run migration:run } finally { Pop-Location }
}

Write-Host ""
Write-Host "Pronto. Proximo passo: suba o tunel e so depois a aplicacao." -ForegroundColor Green
