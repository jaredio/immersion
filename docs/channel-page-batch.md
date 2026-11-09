# Channel browser and embedded-player fixes

Channel pages use a compact Overview and separate Videos and Clips libraries.
Overview shows one recording and three highlights. Libraries provide title/category
search, duration filters, sorting, and grid/list views. About and Schedule retain
native content. This replaces the previous nested native-card styling.

channel-page.js adapts native navigation and metadata; channel-library.js owns the
shadow-root presentation. Native source nodes remain mounted, and actions forward
to their real links. Native Load more controls are forwarded when available.
Unsupported known media markup restores the native presentation. Disabling removes
the browser and restores source attributes.

Search and sorting cover loaded native items, bounded to 300 records per refresh;
they are not a complete remote archive search. Presentation adds no catalog API
requests, provider scripts, autoplay previews, storage, or document observer.
Existing page subscriptions drive refreshes. Images load lazily, and unchanged
metadata preserves keyed cards without repeated DOM writes. These are bounded
rendering changes, not measurements of real Kick's total CPU or memory usage.

Watch together imports media through the existing playback path. Opening a
workspace from a channel profile subroute retains the native live player. Dragging
back over the library cancels without fetching playback metadata. Native routing
and keyboard isolation preserve browsing and Alt-K behavior.

channel-panel.js consolidates duplicate channel identities and forwards missing
stream-header actions to native profile controls. Avatar images stay inside fixed
circular cover crops while the LIVE badge remains outside. About content is
restored when navigating to its dedicated page.

Provider frames fill a positioned player box. YouTube controls and fullscreen are
enabled, landscape players retain a minimum height of 200px, and the close button
sits below the frame. No YouTube API script or replacement playback implementation
is added. See [YouTube parameters](https://developers.google.com/youtube/player_parameters).

## Validation

Run npm.cmd test, npm.cmd run build, and the test:channel-page, test:channels,
test:search, test:full-players and test:workspace-soak scripts. Set KR_ENGINE to
firefox to run the browser checks in Firefox.

Channel fixtures cover overview/libraries, filters, sorting, grid/list, source
navigation and pagination, responsive widths, keyboard isolation, metadata
validation, unsupported markup, header replacement, About and restoration. Thirty
unchanged refreshes preserve native identities and produce zero source DOM
mutations. Search integration exercises pointer drag cancellation and library
playback from the Videos route. Player fixtures cover concurrent playback,
controls, audio ownership, replacement and teardown. These fixtures do not verify
Kick's current production markup or YouTube's live controls. Screenshots are in
ignored artifacts files.

Theme CSS and theme-start.js now run at document_start. Saved appearance settings
apply independently of DOM enhancements, respecting enabled=false. Main UI startup
keeps its hydration-safe idle scheduling with a 250ms deadline. The header only
forwards recognized actions, excludes external social links and deduplicates action
kinds during partial header hydration. test:theme-start verifies saved preferences
while the native HTML parser is deliberately blocked, including disabled mode.

Full-page VOD routes now reuse the header and loaded-video library with native
player/link identities preserved. Related recordings have search, sort, duration
filters and grid/list views. Recording metadata replaces live playback indicators.
Bio social links use local inline SVGs, platform labels, and brand-color hover/focus
states; image panel links and unknown domains retain their authored presentation.
The test:vod-page browser fixture checks these behaviors and full restoration. A
read-only check against current Kick VOD markup also found the header and 28
related recordings; this does not establish performance across all Kick channels.

Primary channel actions use matching 38px heights and consistent minimum widths
for text buttons. Donate precedes Subscribe and uses a local dollar outline SVG.
