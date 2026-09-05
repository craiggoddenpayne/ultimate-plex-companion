# Source guide

- `client/` contains the Vite browser application. Feature UI and CSS stay together under `client/features/`; reusable browser behavior belongs in `client/core/`.
- `server/` contains the Node.js API and media worker. Domain services and their route adapters stay together under `server/features/`; infrastructure belongs in `server/core/`.
- `shared/` contains modules that do not depend on browser or Node.js runtime APIs.

New capabilities should be vertical slices rather than additions to the root or to a generic utilities directory. See `docs/EXTENDING.md` for the complete pattern.
