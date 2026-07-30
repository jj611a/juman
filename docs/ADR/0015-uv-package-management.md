---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0015. uv for Python package management

## Context and Problem Statement

The backend needs reproducible installs on developer machines and deploy hosts. Which Python packaging toolchain should Juman standardize on?

## Decision Drivers

* Fast, reliable lockfiles
* Modern Python 3.13 workflow
* Simple onboarding (`uv sync`)
* Replace fragmented pip/venv/poetry instructions

## Considered Options

* pip + requirements.txt + manual venv
* Poetry
* uv (`pyproject.toml` + `uv.lock`)

## Decision Outcome

Chosen option: "uv (`pyproject.toml` + `uv.lock`)", as used by the shipped backend foundation.

### Consequences

* Good, because reproducible locked installs
* Good, because fast local DX
* Bad, because contributors must install uv
* Neutral, because Ruff/pytest still run via `uv run`

### Future Impact

* Docs and CI should use `uv sync` / `uv run`
* Committing `uv.lock` remains required
* Switching package managers needs a superseding ADR

## Validation

* `backend/pyproject.toml`, `backend/uv.lock`
* [`backend/docs/setup.md`](../../backend/docs/setup.md)

## Pros and Cons of the Options

### pip + requirements.txt

* Good, because universal
* Bad, because weaker lock UX and slower workflows

### Poetry

* Good, because mature locking
* Bad, because overlapping with uv’s chosen direction already in-repo

### uv

* Good, because speed + lockfile + pyproject-native
* Bad, because newer tool familiarity curve

## More Information

* [`backend/docs/setup.md`](../../backend/docs/setup.md)
