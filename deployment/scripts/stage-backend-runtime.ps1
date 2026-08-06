#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)
$ErrorActionPreference = "Stop"

throw @"
backend-python has been removed from this repository.
Staging FastAPI app/alembic/uv.lock into deployment\dist\backend is obsolete.

Use Nest Backend V2: backend-node/.
Installer cutover for Nest packaging is a separate Phase 8.2 task — do not revive FastAPI staging here.
RepoRoot=$RepoRoot
"@
