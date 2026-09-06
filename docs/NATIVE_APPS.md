# Native application bootstrap

The native client is a lightweight Tauri 2 webview for macOS, Android and iOS. It connects directly to an existing Ultimate Plex Companion server. The Docker service remains responsible for Plex credentials, API calls, persistent state and FFmpeg work.

## Security model

- The server URL is compiled into each native build through `UPC_APP_URL`.
- The remotely loaded application receives no Tauri IPC capabilities or local system permissions.
- Credentials are not embedded in the native app; authentication remains on the Companion server.
- Prefer HTTPS through an authenticated reverse proxy or a private TLS-enabled VPN. Do not expose an unauthenticated Companion server publicly.

## Prerequisites

Install Node.js 24+, Rust and the platform toolchain. macOS builds require Xcode command-line tools. iOS builds require full Xcode and CocoaPods. Android builds require Android Studio, its SDK/NDK, Java, `ANDROID_HOME` and `NDK_HOME`.

Check the workstation:

```bash
npm run native:doctor
npm run native:doctor -- android
npm run native:doctor -- ios
```

## Server URL

`localhost` works for a macOS app only when Docker runs on that same Mac. On phones, use a hostname or LAN address reachable from the device. HTTPS is strongly recommended because mobile platforms can restrict clear-text traffic.

```bash
export UPC_APP_URL=https://companion.example.net
```

Do not include credentials in the URL. The validation script rejects them.

## macOS

```bash
npm run native:dev
npm run native:build:macos
```

The build produces an application bundle and DMG beneath the Tauri target directory. Public distribution requires Apple code signing and notarization.

## Android

Initialize the generated Android project once per checkout, then build or open it in Android Studio:

```bash
npm run native:init:android
npm run native:build:android
npm run native:open:android
```

Configure a release signing key before Play Store distribution. The generated platform project is ignored because Tauri can reproduce it.

## iOS

Initialize the generated Xcode project once per checkout, then build or open it:

```bash
npm run native:init:ios
npm run native:build:ios
npm run native:open:ios
```

An Apple Developer membership, development team and signing profile are required for device/App Store distribution.

## Updating branding

The source icon lives in `native-shell/icon.svg`. Regenerate platform icons after initializing mobile projects:

```bash
npx tauri icon native-shell/icon.svg
```

## GitHub Actions builds

The repository workflow `.github/workflows/native-builds.yml` builds all three native targets when a version tag matching `v*` is pushed. It is also available through **Actions → Build native apps → Run workflow**.

Create an Actions repository variable named `UPC_APP_URL` with the HTTPS URL of the deployed Companion server. Manual runs accept an `app_url` override. The value becomes part of the app configuration, so changing it requires another native build.

The workflow produces these artifacts:

- `ultimate-plex-companion-macos-universal`: an ad-hoc-signed universal `.app` and `.dmg` for Intel and Apple Silicon.
- `ultimate-plex-companion-android`: ARM64 and ARMv7 APK/AAB outputs.
- `ultimate-plex-companion-ios-simulator`: an unsigned Apple Silicon Simulator `.app`.

Workflow artifacts are suitable for development and installation testing. Android store packages need a release keystore. Physical-device and App Store iOS builds need an Apple certificate and provisioning profile. Public macOS distribution needs Developer ID signing and notarization.
