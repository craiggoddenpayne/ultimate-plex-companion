import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const platform = String(process.argv[2] || 'macos').toLowerCase();
if (!['macos', 'android', 'ios'].includes(platform)) {
  console.error('Choose one native target: macos, android or ios.');
  process.exit(1);
}

const rawUrl = String(process.env.UPC_APP_URL || 'http://localhost:8080').trim();
let appUrl;
try {
  appUrl = new URL(rawUrl);
} catch {
  console.error('UPC_APP_URL must be a complete http:// or https:// URL.');
  process.exit(1);
}
if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) {
  console.error('UPC_APP_URL must use HTTP(S) and must not contain credentials.');
  process.exit(1);
}
if (platform !== 'macos' && ['localhost', '127.0.0.1', '::1'].includes(appUrl.hostname)) {
  console.error('A phone cannot reach the Docker host through localhost. Set UPC_APP_URL to its HTTPS or LAN URL.');
  process.exit(1);
}
if (appUrl.protocol === 'http:' && platform !== 'macos')
  console.warn(
    'Warning: mobile platforms may block clear-text HTTP. HTTPS or a private TLS-enabled VPN is recommended.',
  );

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(projectRoot, 'src-tauri', 'tauri.generated.conf.json');
const config = {
  app: {
    windows: [
      {
        label: 'main',
        title: 'Ultimate Plex Companion',
        url: appUrl.toString(),
        width: 1440,
        height: 960,
        minWidth: 360,
        minHeight: 640,
        resizable: true,
        fullscreen: false,
      },
    ],
  },
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log(`Native ${platform} target configured for ${appUrl.origin}.`);
