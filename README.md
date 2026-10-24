# Immersion

A sleek dark theme and built-in multistream experience for Kick.

[Download for Firefox](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-firefox.zip) | [Download for Chrome / Edge](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-chrome.zip)

## Features

- Clean dark theme with customizable accent colors.
- Modern sidebars, search, tooltips, and chat styling.
- Alt+K channel switcher with profile pictures and live status.
- Drag channels from the sidebar into multiview.
- Resizable layouts, quick chat tabs, and separate player controls.
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
