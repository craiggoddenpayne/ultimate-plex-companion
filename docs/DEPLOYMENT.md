# Deployment

Copy `.env.example` to `.env`, adjust the media path mapping and start the application:

```bash
docker compose up -d --build
```

Open `http://localhost:8080` (or `APP_PORT`) and use Manage Connection. Docker Desktop users can normally reach a host Plex server at `http://host.docker.internal:32400`. NAS and Linux deployments should use a reachable LAN address.

The media mount must represent the same files Plex reports. For example, if Plex reports `/volume1/media/Films/Movie.mkv`, set `PLEX_MEDIA_ROOT=/volume1/media`, mount that host directory, and set `MEDIA_CONTAINER_PATH=/media`.

Keep the application private. It has administrator functions but no built-in login yet. Use a private network, VPN or authenticated reverse proxy. Back up the Docker data volume and media before enabling replacement workflows.

## Diagnostics and logs

The server writes structured JSON logs to standard output, which works with Docker's logging and rotation facilities. Capture recent output with:

```bash
docker compose logs --tail=500 companion
```

Set `LOG_LEVEL=debug` temporarily for additional request and artwork detail. Startup logs report the Node runtime, data-directory access, frontend build, FFmpeg/FFprobe availability, configuration source, safe Plex origin, configuration permissions, media-mount access and Plex connectivity. Tokens, authorization headers and token query parameters are redacted.

For a shareable snapshot, select **Craig Administrator → Download diagnostics**. The JSON file contains setup checks, queue state and recent in-memory logs without the Plex token. Browser exceptions, rejected promises, API failures and network timeouts are reported into the same diagnostic stream.
