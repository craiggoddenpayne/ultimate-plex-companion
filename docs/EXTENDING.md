# Extending the companion

## Add a navigation surface

Add one object to `feature-registry.js`. The registry validates unique, URL-safe IDs and automatically feeds the navigation and placeholder-page renderer.

Create `my-feature.js` and `my-feature.css`, then include them in `index.html`. The browser module should locate `#my-feature-page`, replace its placeholder content, load data only when needed and render a useful disconnected/error state.

## Add backend behavior

Prefer a focused domain module:

```js
export async function myFeature(config, { plexFetch, libraryItems }) {
  const data = await plexFetch(config, '/library/sections');
  return { count: data.MediaContainer?.size || 0 };
}
```

The module should not read global environment state or start servers. Compose it from `server.js`, validate request input at the boundary and return a deliberately public shape.

## Testing

Test domain modules with injected fake Plex responses. Cover empty libraries, malformed metadata, authorization boundaries and confirmation guards. The integration test owns a temporary mock Plex server and verifies the public API without real credentials.

## Plex mutations

For any mutation:

1. Provide a read-only preview.
2. Show the exact target and effect.
3. Require a simple “Are you sure?” confirmation in the browser.
4. Require `confirmed: true` again on the server.
5. Re-fetch or validate current Plex state before destructive work.
6. Return an auditable summary.
