# Immersion

A sleek dark theme and built-in multistream experience for Kick.

[Download for Firefox](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-firefox.zip) | [Download for Chrome / Edge](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-chrome.zip)

## Features

- Clean dark theme with a pale Kick green default accent (`#B0FF8C`) and alternative accent colors.
- Modern sidebars, search, tooltips, and chat styling.
- Alt+K channel switcher with profile pictures and live status.
- Drag channels into multiview with a subtle drop target and compact drag card.
- Drag-to-resize layouts, quick chat tabs, and direct close, fullscreen, and reorder buttons.
- Optional audio mixing with an indicator on each audible stream.
- Matching channel cards in single-stream and workspace views, with live avatar rings, badges, title, category, language/maturity tags and viewer counts.
- Collapsible formatted bios, socials and responsive image panels, without repeating the channel heading.
- Compact headers with a bottom-centred bio arrow and compact, fully wrapping titles. Ranking badges use a small icon and label. Replaced native panels stay hidden, including panels loaded later, and return when Immersion is disabled.
- Native notifications, follow, gift, subscribe, share and report controls alongside Support. The page's channel uses Kick's existing handlers and states; account actions for other workspace channels open that channel's native controls in a separate window.
- Saved viewing sessions and a collapsible icon toolbar with hover tooltips.
- Click-to-play Kick clip cards in chat, with a movable/resizable floating player and fullscreen.
- Drag clip cards into the workspace to watch alongside live streams or feature a clip.
- A native-style Support button with a compact tip popover, Powerchat/KickBot/StreamElements detection, Firefox embedding, and per-channel saved links.
- Support uses a dollar icon and shares a compact 420px surface with the native Subscribe and Gift Subs popovers. Native checkout prices, validation and selection handlers stay intact; long emote/badge lists scroll within their section. Support anchors to its channel action on desktop and fits the viewport on mobile.

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

Channel details load from Kick's public endpoint and are cached for one minute. If Kick blocks a request, available sidebar details remain visible. Social links appear only when supplied by Kick. Panel text and links are cached for two minutes and shared with support discovery; panel images load when you expand a profile.

**Support** appears beside the channel's native Follow/Subscribe actions and on workspace channel cards. It finds published Powerchat, KickBot and StreamElements URLs in channel bios, panels, and native pinned messages with a broadcaster/moderator badge. It never guesses a tip address from the Kick username. Creator aliases and different services remain separate destinations, with source and recipient shown. Viewer-paid pins do not qualify by themselves. When several services are published, choose one in the popover. If no link is available, save the creator's published tip-page URL for that channel locally.

The real provider form opens in a compact centered popover inside Kick. Powerchat uses its native embeddable page; Firefox also attempts KickBot and StreamElements directly in this popover. Its compatibility hook removes only framing restrictions from one selected tip-page response in the current Kick tab; it preserves the other CSP directives, cookies, payment requests and nested payment frames. Providers that cannot embed retain a separate checkout-window option. The displayed channel and recipient stay fixed while the popover is open, even if you switch channels. A slow or missing readiness signal never discards an open checkout or typed input.

The Firefox package uses the supported Manifest V2 format because Firefox's Manifest V3 webRequest implementation rejects changes to these framing headers. The add-on ID and local storage keys are unchanged, and its background remains an event page. Reload/reinstall the Firefox package and grant the Kick, KickBot and StreamElements site/request permissions to enable this integration. The Chromium build remains Manifest V3.

Amount limits, voices, media options, terms, moderation and payments remain controlled by the provider. No payment details or form values are stored or relayed by Immersion. Provider pages load only when opening Support or explicitly opening checkout. Closing the panel removes the embedded page and cancels any unused framing exception.

Powerchat and KickBot share the same dark cards, input treatment, spacing and mint controls. StreamElements uses the same palette through its public tipping app's stable layout hooks. Provider login, cookie consent, terms, errors, payment options and native checkout validation remain available. The popover has compact service selection and tooltip icons for reloading, opening a checkout window and opening a normal tab. Checkout windows opened through Immersion opt into the same form styling with a URL fragment; ordinary provider tabs are unchanged. The redesign uses local CSS and adds no UI framework or remote widget scripts.

Powerchat's live form has been checked inside the packaged Chromium extension, without submitting payment. KickBot and StreamElements framing compatibility is checked with the installed Firefox add-on against local HTTPS fixtures that send both X-Frame-Options and CSP framing restrictions; other CSP rules and unrelated tip pages remain protected. StreamElements may require its own sign-in. Payment completion remains unverified. Provider changes may require **Open in new tab**; some payment methods may open their own authentication/payment windows. The extension does not manufacture payment confirmations.

To update, reload the extension and refresh Kick.

Hover a message's **Replying to** line to read the original author and quote. The preview sits beside that line, shrinks for short replies, and wraps longer messages within the chat width. Move onto the preview to read or select text; Escape or scrolling closes it. It reads the quote already rendered by Kick and makes no message-history requests.

Clip and X cards recover when Kick assigns message IDs late or replaces the chat container while retaining the old one. X cards removed by chat rendering are recreated from their remaining links. These checks are event driven; metadata remains lazy and cached.

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
npm run test:media
npm run test:channels
npm run test:checkouts
```

Builds and installable ZIPs are created in `dist/`.

`extension/` contains the source and icons, `tools/` contains build and test utilities, and `tests/` contains the regression tests and media fixtures. Browser tests generate disposable output in ignored `artifacts/` and `tmp/` folders. The two `immersion-*.zip` files are the supported browser packages.

Clip browser checks use a small generated HLS video under `tests/clip-media/`. Set `KR_ENGINE=firefox` to run the Firefox engine check. HLS playback uses the locally packaged Apache-2.0 licensed hls.js light build; no CDN script is loaded.

Settings are stored locally. No analytics or custom backend. Independent project; not affiliated with Kick.

X/Twitter posts and profiles, TikTok videos and profiles (including short links), and YouTube videos and Shorts get matching compact cards in regular, workspace and popout chat. Cards use platform logos, author details, copy/open controls and available engagement counts. Clips share the same width and subtle hover treatment; all chat cards leave a small inset from the edges.

TikTok previews show the whole frame within a 190px-high thumbnail; inline playback is capped at 300px, with fullscreen available. A faint alignment cue groups each chat card with its native sender and surrounding message, without adding another sender label or changing username actions.

Playable X videos use native video controls. TikTok and YouTube players load only when you press Play and support fullscreen; closing the player or scrolling it out of view releases it. Private, deleted, restricted or embedding-disabled media may remain unavailable. Original links remain available when metadata fails, with a retry control.

Counts are cached snapshots, not live counters. TikTok cards show public counts when available; profiles show available follower/post totals. YouTube's lightweight oEmbed response does not expose engagement counts, so those are omitted. Disable **X posts & profiles**, **TikTok & YouTube embeds**, or enable **Hide chat images** to restore the respective links.

Metadata requests use the public FxEmbed API (`api.fxtwitter.com`), public TikTok pages/oEmbed (including `vt.tiktok.com` and `vm.tiktok.com` redirects), and YouTube oEmbed. These hosts require extension access. Metadata is requested without cookies, deduplicated, limited to two concurrent jobs per preview service and cached for two minutes. Provider page HTML is parsed for data only; provider widget scripts are never inserted into Kick. Clicking Play creates the official TikTok or YouTube iframe, where provider playback policies apply. X video files load directly from `video.twimg.com`. Provider availability can change independently of Immersion.
