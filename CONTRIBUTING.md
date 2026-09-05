# Contributing

Thanks for helping make Ultimate Plex Companion better. Contributions should preserve its local-first, explainable and original-safe design.

## Before you start

- Search existing issues before opening a new one.
- Use a discussion or feature request for substantial product changes.
- Never include Plex tokens, media paths, viewing history or screenshots containing private library data.
- Keep destructive operations behind an explicit confirmation and a server-side validation check.

## Development setup

Requirements: Node.js 24+, npm and, for codec features, FFmpeg/FFprobe. The repository includes an `.nvmrc` for local version selection.

```bash
npm ci
npm run dev
```

Run the API separately with `npm run server`. Vite proxies `/api` to port 8080.

Before submitting a pull request:

```bash
npm run check
npm test
npm run build
```

## Adding a feature

1. Register the surface in `src/shared/feature-registry.ts` when it needs navigation.
2. Keep Plex/data logic in a focused `src/server/features/<name>` module with dependency injection.
3. Keep browser behavior and styles together in `src/client/features/<name>`.
4. Expose the minimum JSON needed by the browser; never return the Plex token or raw private paths without a clear user-facing need.
5. Add deterministic tests for filtering, validation and destructive-action guards.
6. Document new environment variables and operational risks.

See `docs/ARCHITECTURE.md` and `docs/EXTENDING.md` for concrete patterns.

## Pull requests

Keep changes focused, explain the user-visible outcome, list verification performed and call out security or migration effects. Maintainers may ask for a feature to be split if it combines unrelated behavior.
