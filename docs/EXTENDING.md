# Extending the companion

## Add a feature

Create matching feature folders when the capability has both browser and server behavior:

```text
src/client/features/my-feature/
├── my-feature.ts
└── my-feature.css

src/server/features/my-feature/
├── my-feature-server.ts
└── routes.ts

test/features/my-feature/
└── my-feature.test.ts
```

Register a navigable surface in `src/shared/feature-registry.ts`. Import browser behavior and styles once from `src/client/main.ts`; do not add individual tags to `index.html`.

## Add backend behavior

Keep business logic independent from HTTP and inject its dependencies:

```ts
export async function myFeature(config, { plexFetch, libraryItems }) {
  const data = await plexFetch(config, '/library/sections');
  return { count:data.MediaContainer?.size || 0 };
}
```

Expose it through a feature router that returns `true` only when it handles the request:

```ts
import { requirePlex } from '../../core/router.ts';

export function createMyFeatureRoutes() {
  return async context => {
    if (context.pathname !== '/api/my-feature' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (config) context.json(context.res, 200, await myFeature(config, context));
    return true;
  };
}
```

Add the router factory to the composition list in `src/server/index.ts`. Shared validation belongs in `src/server/core/validation.ts`; Plex network behavior belongs in `src/server/core/plex-client.ts`.

## Testing

Test domain modules with injected fake Plex responses. Cover empty libraries, malformed metadata, authorization boundaries and confirmation guards. Add router tests when HTTP matching or status behavior is non-trivial. The integration test owns a temporary mock Plex server and verifies public behavior without real credentials.

## Plex mutations

For any mutation:

1. Provide a read-only preview.
2. Show the exact target and effect.
3. Require a simple “Are you sure?” confirmation in the browser.
4. Require `confirmed: true` again on the server.
5. Re-fetch or validate current Plex state before destructive work.
6. Return an auditable summary.
