# macOS Signing and Notarization Guide

This document outlines the procedure for signing and notarizing Exoskeleton release builds for macOS distribution using Apple Developer credentials.

---

## Prerequisites

1. **Apple Developer Account**: Active membership in the Apple Developer Program.
2. **Developer ID Application Certificate**: Installed in macOS Keychain Access.
3. **App Store Connect API Key or App-Specific Password**: For non-interactive notarization via `xcrun notarytool`.

---

## Environment Variables

Export the following environment variables before building:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Harold Tajchman (XXXXXXXXXX)"
export APPLE_ID="your-email@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx" # App-specific password
export APPLE_TEAM_ID="XXXXXXXXXX"
```

---

## Build, Sign, and Notarize

### 1. Build Signed DMG & App Bundle

```bash
npm run tauri build
```

Tauri automatically uses `APPLE_SIGNING_IDENTITY` to sign the `.app` bundle and `.dmg` installer.

### 2. Notarize with Apple

Submit the generated DMG for notarization using `xcrun notarytool`:

```bash
xcrun notarytool submit \
  src-tauri/target/release/bundle/dmg/Exoskeleton_0.1.0_x64.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
```

### 3. Staple Notarization Ticket

Once `notarytool` returns `status: Accepted`, staple the ticket to the DMG:

```bash
xcrun stapler staple src-tauri/target/release/bundle/dmg/Exoskeleton_0.1.0_x64.dmg
```

---

## Verification

Verify gatekeeper acceptance on macOS:

```bash
spctl --assess --type execute --verbose src-tauri/target/release/bundle/macos/Exoskeleton.app
```

Output should report: `src-tauri/target/release/bundle/macos/Exoskeleton.app: accepted` with `source=Notarized Developer ID`.
