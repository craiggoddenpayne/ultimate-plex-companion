# Architecture

Ultimate Plex Companion is a local-first TypeScript application with a Vite-built browser client and a dependency-free Node.js HTTP API.

## Source layout

```text
src/
├── client/
│   ├── main.ts              # single browser and stylesheet entry point
│   ├── core/                # application-wide browser behavior
│   ├── features/            # UI modules and styles grouped by capability
│   └── styles/              # shared visual, theme and responsive layers
├── server/
│   ├── index.ts             # runtime composition and media worker
│   ├── core/                # routing, Plex transport, validation and errors
│   └── features/            # domain services and HTTP route adapters
└── shared/                  # environment-neutral models and registries
```

Tests mirror this organization under `test/core`, `test/features` and `test/integration`. The root `server.js` is intentionally a stable compatibility entry point for npm, Docker and existing deployments.

## Runtime flow

```text
client/main.ts → feature UI → /api → feature router → domain service → Plex
                                           ↓
                                  /data persistent state
```

- `src/client/main.ts` defines browser module and CSS cascade order.
- Each client feature progressively enhances one surface created by the application shell.
- `src/server/core/router.ts` composes small route adapters; the first matching feature owns the request.
- Route adapters translate HTTP to domain calls and receive runtime dependencies explicitly.
- Domain modules remain independent of the HTTP server and are tested with fake Plex responses.
- `src/server/core/plex-client.ts` is the only Plex HTTP transport boundary.
- Persistent jobs and automations use atomic JSON writes in `/data`.

## Trust boundaries

The browser never receives the Plex token. API handlers validate identifiers and confirmations again on the server. Read-only scans are separated from media mutations. Codec replacement retains the original until the staged output passes verification.

## Design constraints

- No external analytics or cloud processing.
- Explain the evidence behind recommendations.
- Make read-only previews the default.
- Require explicit confirmation for state-changing or destructive operations.
- Keep domain functions deterministic where possible and inject Plex/network dependencies.
