# Immersion

A sleek dark theme and built-in multistream experience for Kick.

[Download for Firefox](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-firefox.zip) | [Download for Chrome / Edge](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-chrome.zip)

## Features

- Clean dark theme with customizable accent colors.
- Modern sidebars, search, tooltips, and chat styling.
- Alt+K channel switcher with profile pictures and live status.
- Drag channels into multiview with a subtle drop target and compact drag card.
- Drag-to-resize layouts, quick chat tabs, and direct close, fullscreen, and reorder buttons.
- Optional audio mixing with an indicator on each audible stream.
- A focused channel card with an expandable profile, formatted bio, socials, and image panels.
- Saved viewing sessions and a collapsible icon toolbar with hover tooltips.
- Click-to-play Kick clip cards in chat, with a movable/resizable floating player and fullscreen.
- Drag clip cards into the workspace to watch alongside live streams or feature a clip.

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

Enable **Mix audio** to listen to several streams. Drag a tile's bottom-right corner to resize it; grid tiles snap into place. Click a channel card below the players to expand its profile. Double-click a stream header to focus it and switch its chat; Focus layout shows only that channel below, with the other streams in the side rail. The browser tab lists the open channels and restores its original title when multiview closes.

Double-click a stream header, video area, or chat tab to focus that player and enable its audio. Other players mute unless **Mix audio** is enabled; returning to the grid keeps the clicked player's audio. Speaker icons show the current sound state, with **Mute/Unmute** hover labels. Setting a stream's slider to zero mutes it, and unmuting restores its last nonzero level.

Live notifications use a compact dark card and a **Watch** button. Their original channel links, dismiss action, and display duration are preserved.

The main viewing area handles vertical workspace scrolling; chat keeps its own scroll. Columns layout scrolls horizontally, with the original Kick player aligned and clipped to its tile. Workspace layout changes do not animate player positioning or automatically adjust the scroll anchor.

Channel details load from Kick's public endpoint and are cached for one minute. If Kick blocks a request, available sidebar details remain visible. Social links appear only when supplied by Kick. Image panels load when you expand a profile and are cached for two minutes.

To update, reload the extension and refresh Kick.

Hover a message's **Replying to** line to read the original author and quote. The preview sits beside that line, shrinks for short replies, and wraps longer messages within the chat width. Move onto the preview to read or select text; Escape or scrolling closes it. It reads the quote already rendered by Kick and makes no message-history requests.

Clip links in regular and popout chat get a compact player card. Press **Play clip** to load the video. **Pop out clip player** moves it into a floating player without restarting it; return it to chat, resize it, or use fullscreen. Only one clip plays per page/frame. Inline playback stops when its card scrolls out of view or the message is removed; an explicitly popped-out clip can keep playing after its message disappears.

Disable **Playable chat clips** in settings to restore Kick's native previews. **Hide chat images** also disables clip cards. Metadata and the packaged HLS player load on demand, with no autoplay on message arrival. Existing native thumbnails may be reused. If a clip is deleted, blocked, or cannot play, the original Kick link remains available. This uses Kick's public clip endpoint, which can change independently of the extension.

Player cards hide the raw clip URL while keeping the sender and surrounding message visible. Use **Copy clip link** or **Open clip on Kick** in the card controls. Both the card and floating player show **Clipped by** credit when available, reusing native preview details before playback and updating from Kick's clip metadata when loaded. Turning clip cards off restores the original URL and preview.

Drag a clip's thumbnail, title, or **Add clip to workspace** button onto the main viewing area. The drop area highlights with a subtle glowing border: drop on the left to watch alongside, or on the right to feature the clip. Clicking the add button places it alongside without dragging. Clips have a **CLIP** label and duration, use the workspace's audio mixing/mute controls, and keep the live chat selected. Closing the last clip restores the previous layout (or single-stream view if the clip opened the workspace). Clips play once and can be replayed through the video controls.

Same-page moves reuse the player and preserve its position and pause state. A clip dragged out of the selected embedded chat frame loads a player in the parent page at the captured position; it can briefly buffer during the handoff. Clips share the six-tile limit with live streams. Workspace clips are temporary: saved sessions and shared layout links contain live channels; loading a session clears the current clip tiles.

## Build

Requires Node.js 22+ and Python 3.

```sh
npm ci
npm run build
npm test
npm run test:clips
npm run test:posts
```

Builds and installable ZIPs are created in `dist/`.

`extension/` contains the source and icons, `tools/` contains build and test utilities, and `tests/` contains the regression tests and media fixtures. Browser tests generate disposable output in ignored `artifacts/` and `tmp/` folders. The two `immersion-*.zip` files are the supported browser packages.

Clip browser checks use a small generated HLS video under `tests/clip-media/`. Set `KR_ENGINE=firefox` to run the Firefox engine check. HLS playback uses the locally packaged Apache-2.0 licensed hls.js light build; no CDN script is loaded.

Settings are stored locally. No analytics or custom backend. Independent project; not affiliated with Kick.

X/Twitter status links (including links with `?s=20`) get compact previews in regular and popout chat: author, text, images, reposts, likes and views, plus copy/open controls. Counts are a cached snapshot, not live counters; unavailable counts show a dash. Brand and engagement icons use locally bundled SVG paths from X. Video posts show a thumbnail that opens on X. Disable **X post previews** or enable **Hide chat images** to restore the links.

Visible X posts load metadata through the public FxEmbed API (`api.fxtwitter.com`); their public handle and post ID are sent without cookies. Images load directly from `pbs.twimg.com` without a referrer. There are no X widget scripts or autoplay. Requests are deduplicated, limited to two at once, and cached for two minutes. Unavailable/private/deleted posts retain their original link. FxEmbed availability and its access to X can change independently of Immersion. The packages request access only to that metadata API in addition to their existing Kick content scripts.
