# Ultimate Plex Companion

A futuristic, local-first command centre for Plex. It combines live playback telemetry, explainable discovery, library health, metadata repair, playlist generation, automations and guarded codec optimization in one Docker-ready application.

> [!WARNING]
> The application has administrator-level Plex features and does not yet include its own login. Keep it on a trusted private network, behind an authenticated reverse proxy or private VPN.

## Highlights

- Live Plex server, stream and household telemetry
- Explainable Discovery Radar and library-based recommendations
- Playlist Studio with criteria-driven, previewable generators
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

Requirements: Node.js 22+, npm and FFmpeg/FFprobe for codec features.

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

Feature navigation is defined centrally in `feature-registry.js`. Domain logic lives in dependency-injected `*-server.js` modules, browser behavior in focused feature modules and tests in `test/`.

Start with [architecture](docs/ARCHITECTURE.md), [extension patterns](docs/EXTENDING.md) and [contribution guidance](CONTRIBUTING.md).

## Project status

This is pre-1.0 software. Interfaces and stored data may change between releases. Review the [security policy](SECURITY.md) before deployment.

## License

A public open-source license must be selected before the first GitHub release.
