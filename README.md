# Ultimate Plex Companion

[![CI](https://github.com/craiggoddenpayne/ultimate-plex-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/craiggoddenpayne/ultimate-plex-companion/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Node.js 22.18+](https://img.shields.io/badge/Node.js-22.18%2B-5FA04E.svg)](package.json) [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](tsconfig.json)

A futuristic, local-first command centre for Plex. It combines live playback telemetry, explainable discovery, library health, metadata repair, playlist generation, automations and guarded codec optimization in one Docker-ready application.

> [!WARNING]
> The application has administrator-level Plex features and does not yet include its own login. Keep it on a trusted private network, behind an authenticated reverse proxy or private VPN.

## Highlights

- Live Plex server, stream and household telemetry
- Explainable Discovery Radar and library-based recommendations
- Playlist Studio with 22 live generators and an eight-control custom signal composer
- Metadata integrity scanning and guided repair
- Duplicate/edition review with copy-level evidence
- Persistent, verified HEVC, AV1 and VP9 conversion queues
- Auditable automations with dry runs and summaries
- Responsive, themeable command interface
- Local processing with no external analytics

## Quick start with Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:8080`, select Manage Connection and enter the Plex server URL and X-Plex-Token. The connection is tested before it is stored.

Docker Desktop users can normally reach Plex on the host at `http://host.docker.internal:32400`. For a NAS or another machine, use its LAN address. See [deployment guidance](docs/DEPLOYMENT.md) for media path mapping and security recommendations.

## Local development

Requirements: Node.js 22.18+, npm and FFmpeg/FFprobe for codec features.

```bash
npm ci
npm run server
```

In another terminal:

```bash
npm run dev
```

Useful checks:

```bash
npm run check
npm test
npm run build
```

## Configuration

Configuration is stored in `/data` inside the container. You can configure Plex through the browser or the `PLEX_URL` and `PLEX_TOKEN` environment variables. Environment-managed credentials cannot be changed from the UI, and the token is never returned to the browser.

Codec Studio needs the same media files Plex reports. Configure:

- `MEDIA_HOST_PATH`: directory on the Docker host
- `PLEX_MEDIA_ROOT`: prefix present in Plex metadata
- `MEDIA_CONTAINER_PATH`: mount location inside Companion
- `HEVC_CRF`: quality value from 16–26 (default 20)
- `HEVC_PRESET`: `fast`, `medium` or `slow`

See [.env.example](.env.example) for a complete template.

## Safe media operations

Codec conversions create a separate MKV, preserve audio/subtitles/chapters/metadata, and verify codec, duration, size and stream counts. The original remains untouched until an administrator approves a final confirmation. Duplicate deletion likewise revalidates the Plex item before issuing a delete request.

“Visually transparent” is a quality target, not mathematical losslessness. Keep independent backups of irreplaceable media.

## Extending the project

Feature navigation is defined centrally in `src/shared/feature-registry.ts`. Browser and server capabilities are grouped into matching TypeScript folders under `src`, with mirrored TypeScript tests under `test`.

`npm run check` performs a no-emit TypeScript compile across the browser, server, shared modules and tests. The small root `server.js` compatibility entry remains intentionally stable for Docker and existing deployments; application logic lives in TypeScript.

Start with [architecture](docs/ARCHITECTURE.md), [extension patterns](docs/EXTENDING.md) and [contribution guidance](CONTRIBUTING.md).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), which covers local setup, tests, feature structure and safety expectations. Use the issue templates for bugs and proposals, read [SUPPORT.md](SUPPORT.md) for help, and report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

Run `npm run ci` before opening a pull request. New Plex mutations must provide a read-only preview, server-side validation and explicit confirmation.

## Project status

This is pre-1.0 software. Interfaces and stored data may change between releases. Review the [security policy](SECURITY.md) before deployment.

## License

Released under the [MIT License](LICENSE). Plex is a trademark of Plex, Inc. This independent project is not affiliated with or endorsed by Plex.
