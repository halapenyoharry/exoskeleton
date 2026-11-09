# tldraw

## What it is

The [tldraw SDK](https://github.com/tldraw/tldraw) (npm package `tldraw` 5.6.0) rendered stock inside a Dockview panel.

## Where drawings live

Drawings are stored under tldraw's `persistenceKey` `exoskeleton-tldraw-<panel id>` in this browser's IndexedDB. The first panel's id is `tldraw`; clones from the `+` picker get `tldraw-xxxx` and start blank. Closing and re-adding `tldraw` brings its drawing back. Storage is per browser origin, so the same app on a different host or port has a separate set of drawings.

## Assets

Fonts, icons and translations come from `@tldraw/assets/imports.vite`, bundled by Vite, so the panel makes no requests to tldraw's CDN.

## License

tldraw is source-available under its own license (not open source; Exoskeleton is AGPL-3.0-or-later). Without a license key, tldraw treats any page served over plain http (the dev server, on LAN or Tailscale) as development: full editor plus a small "Get a license for production" mark in the bottom-right corner, and no network request. On an https production build (exo-skeleton.org) with no key, the editor blanks after 5 seconds and sends one tracking request to tldraw's CDN with the page URL. A key goes in Tldraw's `licenseKey` prop; tldraw offers a hobby license (watermark required, no data sent). See https://tldraw.dev/community/license. Decision pending before the next deploy.
