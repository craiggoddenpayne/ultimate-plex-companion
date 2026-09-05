# Architecture

Ultimate Plex Companion is a local-first Node.js application with a Vite-built browser client and a small dependency-free HTTP API.

## Runtime flow

```text
Browser modules → /api routes → focused domain modules → Plex Media Server
                                      ↓
                              /data persistent state
```

- `server.js` owns HTTP, configuration, Plex transport and route composition.
- `*-server.js` modules implement domain logic and accept dependencies explicitly for isolated tests.
- Browser feature modules own a single application surface and progressively replace their registered placeholder page.
- `feature-registry.js` is the source of truth for navigation, fallback copy and feature concepts.
- CSS is feature-scoped. Cross-cutting responsive, theme and accessibility layers load after feature styles.
- Persistent jobs and automations use atomic JSON writes in `/data`.

## Trust boundaries

The browser never receives the Plex token. API handlers validate identifiers and confirmations again on the server. Read-only scans are separated from media mutations. Codec replacement retains the original until the staged output passes verification.

## Design constraints

- No external analytics or cloud processing.
- Explain the evidence behind recommendations.
- Make read-only previews the default.
- Require explicit confirmation for state-changing or destructive operations.
- Keep domain functions deterministic where possible and inject Plex/network dependencies.
