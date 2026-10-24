# Immersion

A sleek dark theme and built-in multistream experience for Kick.

[Download for Firefox](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-firefox.zip) | [Download for Chrome / Edge](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-chrome.zip)

## Features

- Clean dark theme with customizable accent colors.
- Modern sidebars, search, tooltips, and chat styling.
- Alt+K channel switcher with profile pictures and live status.
- Drag channels into multiview with a glass placement preview and compact drag card.
- Drag-to-resize layouts, quick chat tabs, and direct close, fullscreen, and reorder buttons.
- Optional audio mixing with an indicator on each audible stream.
- Channel cards with titles, categories, viewer counts, and social quick views.
- Saved viewing sessions and a distraction-free Quiet view.

## Install

**Firefox 142+**

1. Download the Firefox ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select the ZIP.
4. Open or refresh Kick.

This unsigned development install lasts until Firefox restarts.

**Chrome / Edge**

1. Download and extract the Chrome ZIP.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode** and click **Load unpacked**.
4. Select the extracted folder, then refresh Kick.

## Use

Open **Immersion** at the bottom of Kick's sidebar for settings. Press **Alt+K** to switch channels, or drag a sidebar channel onto the stream to start multiview. Double-click a stream header to focus it; drag the divider to resize.

Enable **Mix audio** to listen to several streams. Drag a tile's bottom-right corner to resize it; grid tiles snap into place. Hover or focus a channel card below the players for its quick view. The browser tab lists the open channels and restores its original title when multiview closes.

Channel details load from Kick's public endpoint and are cached for one minute. If Kick blocks a request, available sidebar details remain visible. Social links appear only when supplied by Kick.

To update, reload the extension and refresh Kick.

## Build

Requires Node.js 22+ and Python 3.

```sh
npm ci
npm run build
npm test
```

Builds and installable ZIPs are created in `dist/`.

Settings are stored locally. No analytics or custom backend. Independent project; not affiliated with Kick.
