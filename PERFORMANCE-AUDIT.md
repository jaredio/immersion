# Immersion client performance audit

Audited October 25, 2026 (America/Chicago). This is a code review plus one anonymous, extension-free Chromium load of Kick's public homepage. It is not a measurement of the user's signed-in session or a controlled before/after benchmark.

## Changes delivered

- Replaced the ghost multistream layout with a transparent outline and a small drop cue. No cloned settings, placeholder player cards, blur, or background wash.
- Kept a compact channel card near the cursor. Pointer movement updates its transform through one scheduled animation frame.
- Cached drop-target geometry during pointer movement; remeasure on scroll, resize, or main-container resize. Disconnect the temporary resize observer when dragging ends.
- Reject duplicate and full-workspace drops before activating multistream. Escape, drag end, route changes, and window blur clean up the drag UI.

These remove known work from dragging. They are not a measured site-wide speedup.

## What the live baseline showed

Raw aggregate evidence: [artifacts/kick-performance-audit.json](artifacts/kick-performance-audit.json). Reproduce with `node tools/audit-kick.mjs`.

The browser used a fresh context, no extension, and no saved cookies or login. It observed navigation plus 8 seconds after DOMContentLoaded. Network conditions, consent state, region, caching, and featured streams can change the result. The probe records no headers, bodies, cookies, or URL query strings.

| Observation | Single-run result |
| --- | ---: |
| Attempted HTTP(S) requests, including canceled requests | 273 |
| Distinct HTTP(S) hostnames | 53 |
| Script requests | 109 |
| Main-frame long tasks | 28, totaling 3.54 seconds |
| CDP task duration | 6.33 seconds |
| CDP script duration | 2.81 seconds |
| CDP layout plus style duration | 1.01 seconds |
| Main-frame DOM elements | 2,243 |
| CDP JavaScript heap used | 75.9 MiB |

The timing and heap metrics cover the inspected page target, not total browser CPU, GPU, or every cross-origin frame. Resource Timing transfer sizes omit some cross-origin sizes; the recorded byte count is not total bandwidth. This run does not attribute CPU time to individual trackers.

## Recommended work, in priority order

| Priority | Change | Evidence and likely benefit | Validation needed |
| --- | --- | --- | --- |
| 1 | Refresh only affected extension UI | `content.js` observes child-list changes across the document, skips message descendants, then runs a broad refresh after 180 ms. Split sidebar, route, search, and layout invalidation. Cache stable search/sidebar nodes and stop scanning unrelated page changes. | Count refreshes and selector work during busy chat, navigation, menus, and sidebar updates; retain hydration repair. |
| 2 | Patch multistream metadata in place | Channel-detail responses call `render()`. Rendering rebuilds chat tabs, channel summaries, suggestions, and saved-session options, then checks layout/audio. Update only changed titles, categories, counts, and the expanded profile; batch responses. | Preserve focused controls, player identity, chat identity, scroll position, and audio behavior. |
| 3 | Add an optional narrow analytics blocker | The live load contacted Google Analytics/Tag Manager, Datadog's browser-agent host, TikTok analytics, Meta, Quora, Yahoo analytics, and advertising hosts. Blocking reviewed scripts early can avoid their execution and downstream requests. | Test exact rules in an isolated context first, then signed-in playback/chat/login and purchases; measure savings rather than promising a percentage. |
| 4 | Provide optional multistream resource limits | Up to six live players remain running. A muted stream still performs video playback work. Offer explicit secondary-stream quality limits, pause for offscreen secondary tiles, and an opt-in background-tab policy. | Kick's player SDK must actually be reachable; the current bridge controls HTML video playback/volume, not quality. Never assume muting saves decoding or bandwidth. Preserve audible streams and user pause choices. |
| 5 | Make player discovery incremental | `player-frame.js` watches all subtree child-list mutations, then scans for video elements after an 80 ms throttle. Filter mutations for added/removed videos and keep an invalidated cache of connected elements. | Replacement players, ads, multiple video elements, delayed playback, autoplay restrictions, and player teardown. |
| 6 | Defer offscreen extension profile rendering | Expanded channel panels can contain images and rich markup. Lazy image loading already exists. Consider `content-visibility: auto` with an appropriate intrinsic size on self-contained extension profile panels. | Scroll stability, focus, browser find, image loading, and accessibility. Do not apply it to Kick's measured/virtualized chat rows. |
| 7 | Offer a stronger static-media mode | Text-only chat currently uses `visibility: hidden`, which preserves row measurements but does not establish that image downloads or animated-image decoding stop. Reducing rendering effects is already enabled by default. | A genuine media-saving mode needs separately verified resource rules or a native static-emote preference; prevent broken badges/avatars and virtualizer height changes. |

CSS-hiding recommendations or promotions makes the interface quieter; it does not by itself stop React work, API calls, image loads, or background timers. Likewise, removing DOM elements React owns can cause repeated reconstruction and extra work.

## Telemetry and bloat: what to target

These are observed hosts, not a shipped blocklist or a claim that every request is dispensable.

| Observed host/group | Suggested treatment |
| --- | --- |
| `www.google-analytics.com`, `analytics.google.com`, `www.googletagmanager.com` | First candidates for an optional analytics mode. Inspect Tag Manager dependencies before blocking the entire container. |
| `www.datadoghq-browser-agent.com` | Monitoring candidate. Datadog documents browser performance/error collection; seeing its loader does not prove session replay was enabled. |
| `analytics.tiktok.com`, `analytics-ipv6.tiktokw.us`, `connect.facebook.net`, `a.quora.com`, `q.quora.com`, `connectid.analytics.yahoo.com`, `ups.analytics.yahoo.com` | Marketing/measurement candidates for an exact-host ruleset after functional checks. |
| DoubleClick, Google Syndication, OpenX, Criteo, ID5, AdsRvr, and other ad-related hosts in the JSON | Separate optional advertising rules. Blocking these does not guarantee removal of stream-inserted ads. |
| `platform.datazoom.io`, `reporting.cdndex.io`, `player.stats.live-video.net` | Review individual requests and initiators first. Treat video measurement endpoints separately from playback and do not block whole parent domains. |
| OneTrust consent and geolocation hosts | Keep consent controls working; do not assume their scripts are ordinary analytics. |
| Stripe hosts | Keep payment-related functionality working. Avoid an unrestricted global Stripe rule. |
| `flags.kick.com`, `web.kick.com`, `websockets.kick.com`, Kick assets/images, IVS playback/HLS/device configuration | Preserve core site, feature configuration, chat, and playback. Their presence alone is not evidence of removable telemetry. |
| General Google/gstatic/CDN domains | No broad rules: shared domains can serve functional scripts as well as tracking code. |

Implementation should use browser-native `declarativeNetRequest` rules scoped to Kick traffic, with a reversible settings toggle and exact domains/paths. The current extension has only the `storage` permission and no network rules/background worker. A blocking feature would require manifest and settings changes, including appropriate extension permissions. Prefer that to overriding page-wide `fetch`, `XMLHttpRequest`, `sendBeacon`, or WebSocket APIs.

## Existing optimizations worth preserving

- Lean chat/motion defaults on: native smooth chat scrolling is changed to instant, and chat animation, shadows, and blur are suppressed.
- The document observer ignores mutations within chat message rows, and popout chat has a much narrower attribute observer.
- Native current-stream video stays in its React-owned tree; layout changes do not reload embedded players.
- Player commands avoid repeated media setters and feedback loops.
- Channel details have a 60-second cache; profile panels have a 120-second cache and load only on expansion. Profile images load lazily.
- Settings remain local. No extension analytics SDK or external telemetry backend was found in the source audit.

## Benchmark plan

Compare extension disabled, current extension, and one candidate optimization at a time. Use repeated cold and warm runs on the same machine and route. Cover idle playback, fast chat, channel navigation, dragging, and two/four/six streams. Record main-thread task time, long tasks, layout/style work, refresh counts, request counts, playback dropped frames, and process CPU/memory. Report medians and range. A homepage run cannot establish multistream playback savings.

No telemetry blocking or additional performance settings were installed as part of this audit; the delivered behavior change is the drag interaction.

## Technical references

- [Chrome declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest): native request rules and permission requirements.
- [Kick cookie policy](https://kick.com/cookie-policy): distinguishes essential functionality, analytics, and targeting categories.
- [Datadog browser error tracking](https://docs.datadoghq.com/real_user_monitoring/error_tracking/browser/): documented monitoring SDK and loader.
- [Amazon IVS web player setup](https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/web-getting-started.html): quality and audio-only SDK controls; integration feasibility remains to be verified for Kick.
- [web.dev content-visibility guidance](https://web.dev/articles/content-visibility): deferred offscreen layout/painting and containment implications.
