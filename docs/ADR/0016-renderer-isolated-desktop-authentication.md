# ADR 0016: Renderer-Isolated Desktop Authentication & Session Management

## Context and Problem

The Juman desktop frontend (rebuilt in Electron + React) must authenticate against a frozen NestJS backend. A common web application vulnerability is exposing raw JWT tokens (both access and refresh tokens) to the renderer process. Doing so exposes credentials to potential Cross-Site Scripting (XSS) or prototype pollution attacks within the browser context. We need a secure mechanism to handle tokens and maintain sessions, ensuring the React renderer never directly sees or stores raw JWTs.

## Decision

We isolate token management entirely in the Electron Main process:

1. **Token Isolation:**
   - **Electron Main Process (`SessionManager`)** owns the HTTP client instance and manages the tokens.
   - **Access Token:** Stored in Main process memory only.
   - **Refresh Token:** Encrypted using OS-level credential storage (`safeStorage` on Windows) and stored locally under `userData/secure/session.bin`.

2. **Preload API Boundary:**
   - The Renderer process interacts with authentication solely via pre-defined IPC invoke channels (`window.juman.auth`).
   - The IPC return values are strictly transformed into a safe, non-credentialed `SessionView` representation:
     ```typescript
     export interface SessionView {
       authenticated: boolean;
       user: {
         id: string;
         username: string;
         displayName: string | null;
         roles: string[];
         permissions: string[];
       } | null;
       mustChangePassword: boolean;
     }
     ```

3. **Session Restore Flow:**
   - On startup, the Main process bootstraps by reading the local credential blob. If present, it executes `/auth/session` using the `Authorization: Bearer <accessToken>` and `x-refresh-token` headers.
   - Any rotated tokens returned by the backend are processed and persisted inside the Main process without informing or exposing them to the Renderer.

## Consequences

- **Pros:**
  - Complete mitigation of token theft via renderer XSS.
  - Transparent token rotation (tokens are stored and refreshed completely in Main).
  - Robust desktop-native encryption (`safeStorage`).
- **Cons:**
  - Slight overhead due to IPC message serialization.
