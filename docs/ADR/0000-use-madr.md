---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0000. Use MADR for architecture decisions

## Context and Problem Statement

Juman is built incrementally (foundation → modules). Without a written decision log, later contributors will reverse foundational choices (e.g. quantity stock for dresses, hard deletes, unversioned APIs). How should we record binding architectural decisions?

## Decision Drivers

* Traceability for future module authors
* Lightweight process suitable for a focused POS/ERP team
* Markdown-native docs already living under `docs/`
* Need for status, alternatives, and consequences — not only “what”

## Considered Options

* Informal README notes only
* Full Architecture Decision Records (MADR)
* Heavyweight enterprise ADM tools / wiki-only decisions

## Decision Outcome

Chosen option: "Full Architecture Decision Records (MADR)", because it is standard, diff-friendly, and fits the existing documentation layout.

### Consequences

* Good, because decisions are numbered, searchable, and reviewable in git
* Good, because supersession is explicit
* Bad, because authors must spend time writing ADRs for significant changes
* Neutral, because day-to-day implementation notes stay in module docs

### Future Impact

* Significant architecture changes require a new ADR (or supersession)
* Module work that contradicts an `accepted` ADR is rejected until the ADR is updated
* `docs/ADR/README.md` remains the index of record

## Validation

* Presence of `docs/ADR/` and index links
* PR / change review checks for ADR updates on architectural shifts

## Pros and Cons of the Options

### Informal README notes only

* Good, because low ceremony
* Bad, because decisions blur into narrative and lack status/alternatives

### Full Architecture Decision Records (MADR)

* Good, because structured Context / Options / Consequences
* Bad, because more files to maintain

### Heavyweight enterprise ADM tools

* Good, because rich workflow
* Bad, because overkill for current team size and offline-friendly desktop product

## More Information

* Template: [`adr-template.md`](adr-template.md)
* Upstream: https://adr.github.io/madr/
