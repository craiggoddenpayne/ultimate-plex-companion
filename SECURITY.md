# Security policy

## Supported versions

Until the first stable release, security fixes are applied to the latest `main` branch only.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities, exposed tokens or private media data. Use GitHub private vulnerability reporting for this repository once it is published. Include impact, reproduction steps and a suggested mitigation if available.

## Deployment boundary

Ultimate Plex Companion currently has administrator-level Plex capabilities and does not yet provide its own user authentication. Keep it on a trusted private network, behind an authenticated reverse proxy or private VPN. Do not expose port 8080 directly to the public internet.

Plex tokens are stored in the configured data directory with restrictive file permissions and are never returned by the public configuration API. Treat backups of that directory as secrets.

Codec replacement and overlap deletion can remove media. Those paths require explicit confirmation, but independent backups remain strongly recommended.
