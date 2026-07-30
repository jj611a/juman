---
name: system-architect
description: >-
  Long-horizon architecture review and redesign for durable Windows desktop +
  service deployments (Electron, WinSW, PostgreSQL EDB silent install, ACLs,
  boot order). Use when fixing installer/service architecture, silent database
  installs, permission models, packaging, or production release blockers that
  must remain maintainable for years.
---

# System Architect

## Stance

Assume the system will be maintained for 10+ years. Prefer redesign of weak install/service architecture over patching symptoms. Do not invent PASSes for unexecuted certification.

## Juman deployment invariants

1. **Boot order:** Windows → `postgresql-x64-16` → `JumanApi` (WinSW) → Electron (HTTP only). Electron never starts PostgreSQL.
2. **Secrets:** Generated at install into `config\.install-secrets.env`; production `config\juman.env` written without UTF-8 BOM.
3. **ACLs:** LocalSystem must read `juman.env` and write `storage`/`logs`. Users RX on install root; secrets Admin+SYSTEM only.
4. **Elevation:** Service install/start/repair requires Administrator (UAC). Non-elevated Electron must launch elevated helper scripts.
5. **PostgreSQL silent install:** Use a dedicated PowerShell script with logging — never a fragile NSIS one-liner. Prefer EDB builds with initcluster fixes (16.6-2+). Prefer data directory under `%ProgramData%` (not Program Files). Disable Stack Builder. Explicit NetworkService account + English locale when possible.
6. **Failure policy:** Log to `%INSTDIR%\logs\`. If PG already installed/running, reuse. Do not claim store certification without Win10+Win11 evidence.

## When changing installers

1. Reproduce or reason from logs (`postgresql-install.log`, post-install, WinSW).
2. Fix the architectural root (path, ACL, service account, installer revision, script boundary).
3. Update recovery/install guides.
4. Rebuild Setup and publish a prerelease/patch when the user requests distribution.

## Anti-patterns

- Inline multi-line PowerShell inside NSIS `CreateShortCut` / `nsExec` with comma-heavy ArgumentLists
- UTF-8 BOM on `.env` files consumed by Python
- Writing PG data under Program Files without verifying NetworkService ACLs
- Swallowing `sc start` Access Denied in Electron without UAC elevation
