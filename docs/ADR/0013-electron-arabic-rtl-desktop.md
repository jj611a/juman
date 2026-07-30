---
status: accepted
date: 2026-07-26
deciders: Juman architecture
---

# 0013. Electron desktop client with Arabic RTL first

## Context and Problem Statement

Juman is a store POS, not a public web SaaS. What is the primary client platform and UI language posture?

## Decision Drivers

* Windows store PCs, printers, barcode scanners
* Arabic-first operators (RTL)
* English reserved for code, APIs, and database naming
* Offline/LAN friendly deployment

## Considered Options

* Responsive web app (browser-only) as primary client
* Electron + React + TypeScript desktop app (Arabic RTL first)
* Native .NET WPF/WinUI only

## Decision Outcome

Chosen option: "Electron + React + TypeScript desktop app (Arabic RTL first)", with FastAPI as the backend. English remains the language of source code, JSON keys, and permission/error codes.

### Consequences

* Good, because hardware integration path for scanners/printers is realistic
* Good, because RTL UX matches operators
* Bad, because two runtimes to ship (Electron + API)
* Neutral, because a future web admin is not forbidden but is not v1 primary

### Future Impact

* UI copy defaults to Arabic; API `error.message` Arabic
* Desktop auth follows Identity Rules (username login)
* UI must not be the authorization authority

## Validation

* Project README / constitution language rules
* [`docs/API_STANDARDS.md`](../API_STANDARDS.md) language section

## Pros and Cons of the Options

### Browser-only web primary

* Good, because easier distribution
* Bad, because weaker peripheral control and store offline posture

### Electron + React + TS

* Good, because desktop POS fit
* Bad, because packaging complexity

### Native .NET only

* Good, because Windows-native
* Bad, because splits from chosen Python backend ecosystem and current roadmap

## More Information

* Root [`README.md`](../../README.md)
* ADR [0011](0011-versioned-rest-api-envelope.md)
