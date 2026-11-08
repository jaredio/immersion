# Immersion architecture and performance roadmap

This roadmap is based on the current extension source and its browser fixtures.
“Implemented” means code and targeted tests exist; other rows are proposals,
not promises of measured gains. Full Kick players remain the default.

## Implemented in the current refactor

| Upgrade | Result |
| --- | --- |
| Shared document subscriptions | A lazy, per-frame `dom.js` service owns document observation. Content refreshes, chat discovery and live notices subscribe to it. |
| Shared chat subscriptions | Clips, X cards and other media share one chat observer. Each feature gets only its requested attributes. Disabled features unsubscribe. |
| Container lifecycle | React chat replacement and late ID assignment are detected even when the old container remains connected. The last unsubscribe disconnects both shared observers. |
| Idempotent service loading | Repeated loading preserves the existing DOM subscription service. |
| Separate popout workload | Native chat popouts load their chat entry point without also loading the full workspace/controller script set. |
| Workspace view module | `multi-view.js` owns markup, icons and the initial control structure. |
| Layout lifecycle module | `multi-layout.js` owns surface discovery, reversible styles and frame scheduling. |
| Metadata module | `multi-metadata.js` owns bounded channel/panel caches, pending work and late-response suppression. HTTP remains in the shared channel service. |
| Session module | `multi-session.js` owns normalized loading, coalesced saves, write order, error recovery and final flushing. |
| Player-message module | `multi-player-bus.js` owns frame registration, constant-time source lookup, origin/session/revision validation and listener disposal. |
| Storage backpressure | Rapid changes replace a pending snapshot instead of issuing one storage write per input event. Closing/destroying flushes pending state. |
| Test script loading | General workspace and clip tests read content/chat injection order from the built manifest instead of duplicating long script lists. Smaller isolated fixtures keep their explicit dependencies. |

The shared observers replace five document watchers and three chat-row watchers
in these migrated features with one of each when they are enabled. Specialized
player, channel-header, dialog, reply-preview and sidebar observers remain where
their targets and lifetimes are different. This is not a claim of two observers
for the entire Kick application.

## P1 — highest-value next work

| # | Upgrade | Reason and acceptance evidence |
| --- | --- | --- |
| 1 | Local performance diagnostics | Add an explicit diagnostics mode with bounded counters for refreshes, dirty rows, layout passes, requests, storage writes and frame messages. Off by default; no remote collection. Export sanitized results. Establish a baseline before setting budgets. |
| 2 | Repeatable 1/2/4/6-stream benchmarks | Compare Full Kick and standard embeds, grid/focus/columns, chat idle/flood, and background/foreground. Record hardware/browser, medians and tail latencies over repeated runs. Live tests require channels actually streaming and supported media decoding. |
| 3 | Separate control discovery from state updates | `player-controls.js` currently searches native buttons during control synchronization. Cache discovered sources; rediscover on structural changes, update only changed state for volume/play/focus. Preserve native menu replacement. |
| 4 | Keyed channel-directory rendering | `renderDirectory()` currently replaces all cards. Update existing cards by channel and data version; preserve focus, open details and popovers without rebuilding neighbors. |
| 5 | Incremental toolbar/chat picker updates | Avoid rebuilding chat options, tabs, datalists and saved-session options on unrelated volume or playback changes. Invalidate only the affected view. |
| 6 | Avoid repeated SVG/attribute writes | `decorate()` rebuilds icon markup on repeated audio/playback updates. Cache the rendered icon/label/state and skip unchanged DOM writes. Verify accessibility labels stay correct. |
| 7 | Layout read/write phases | Collect geometry before style changes; cache viewport/chat rectangles for one frame. Handle rail-height corrections in a subsequent frame rather than forcing repeated layout. Verify columns scrolling and native overlays still align. |
| 8 | Unified row indexing | Build a row-level anchor/identity index once per dirty batch, shared by chat enhancements. Invalidate on virtualized-row reuse and relevant attribute changes. Never cache solely by `data-index`. |
| 9 | Bound chat processing per turn | Give dirty-row processing a measured time budget and resume pending rows later. Keep visible rows responsive under bursts; do not create an unbounded task or request queue. |
| 10 | Reduce player status traffic | Send status when meaningful fields change and on handshake/recovery. Coalesce bursts; keep readiness and pause commands immediate. Verify dropped or delayed status cannot leave audio ownership wrong. |
| 11 | Stagger full-player initialization | Limit concurrent full-page starts, prioritize the selected pane, and cancel queued starts when removed. Do not delay the retained native player or audio focus. Measure time-to-first-frame for all panes. |
| 12 | Explicit lightweight viewing policy | Offer per-pane/player-mode choices with clear native-feature differences. A full Kick page includes React, hidden chat and background services. CSS cannot remove that runtime cost. Preserve the user's Full Kick default. |

## P2 — reliability and code quality

| # | Upgrade | Reason and acceptance evidence |
| --- | --- | --- |
| 13 | Extract remaining controller responsibilities | Move chat mounting/picker behavior, stream-tile lifecycle, and clip placement into modules with small callback interfaces. Keep one orchestration owner for active workspace state and audio focus. |
| 14 | Explicit workspace/player states | Document and encode loading, ready, blocked, offline, paused, closing and disposed transitions. Avoid adding more loosely related booleans. Test rapid add/remove/retry/mode changes. |
| 15 | Structured lifetime scopes | Give each workspace/pane a disposal scope owning event listeners, observers, timers, animation frames and pending jobs. Teardown should be idempotent and leave no retained frame references. |
| 16 | Request priorities and cancellation | Add a small bounded metadata queue with selected/visible channels first. Use generation tokens or consumer-aware cancellation so closing a pane does not abort a request another feature needs. |
| 17 | Shared bounded response reader | Support/search currently check text size after buffering. Use one streaming byte-limited reader with timeout, content-type validation and consistent errors. Keep HTML catalog and JSON limits explicit. |
| 18 | Atomic settings/session mutations across tabs | Per-tab write queues do not prevent two tabs replacing each other's snapshots. Serialize patches through a background owner or use explicit revision/conflict handling. Test two tabs saving distinct sessions concurrently. |
| 19 | Versioned stored schemas | Add explicit storage migrations and a bounded recovery path for corrupted settings/sessions. Preserve existing extension ID and user preferences. |
| 20 | Clear message/data contracts | Add JSDoc types and runtime guards at network/frame/storage boundaries. Consider type-checking JavaScript before considering a language migration. Reject invalid status payloads without corrupting state. |
| 21 | Formatting and static checks | Format source consistently, introduce a scoped linter, and enforce unused-variable checks. Make formatting a separate reviewable change; retain browser-tested selectors and behavior. |
| 22 | Finish consolidating test configuration | General workspace/clip injection lists now use the manifest. Keep isolated-feature dependencies explicit and centralize the remaining repeated browser setup, fixture routing and result reporting. |
| 23 | Selector compatibility adapter | Centralize Kick DOM selectors and fallbacks by feature. Detect unsupported markup and retain native behavior instead of hiding content that could not be replaced. |
| 24 | Installed-browser regression matrix | Retain fast shim fixtures, but add actual installed Chrome/Firefox checks for settings, chat replacement, full/embed fallback and checkout. Separate offline, network-denied and unsupported-codec outcomes from code failures. |
| 25 | Lifecycle and soak tests | Run repeated open/close/navigation/mode-switch cycles. Measure retained iframe/video/observer counts and heap trends; test cached back/forward navigation and extension reload. |
| 26 | Reproducible release checks | Validate manifest references, local-only runtime code, minimal permissions and packaged file lists. Exclude browser caches, diagnostics and secrets; verify installable ZIPs before release. |

## P3 — privacy, resilience and product improvements

| # | Upgrade | Reason and acceptance evidence |
| --- | --- | --- |
| 27 | Auditable telemetry rule evolution | Version each new rule with observed endpoint, purpose and compatibility checks. Keep a documented disable switch. Do not block first-party APIs merely because their paths contain “event” or “analytics.” |
| 28 | Isolate player telemetry experiments | Test Datazoom/Mux/IVS reporting separately from player SDK loading. Check playback, seeking, quality switching and retry behavior before enabling any new rule. No claim of removing all telemetry. |
| 29 | Optional resource-saving policies | Offer explicit offscreen pause, background-tab behavior and muted secondary quality preferences. Never silently pause the audible stream; keep Mix audio and user overrides authoritative. |
| 30 | Local playback-health display | Use supported video-quality/frame APIs for dropped frames, stalls and first-frame time. Avoid permanent high-rate sampling. Keep browser support and “unknown” values explicit. |
| 31 | Recoverable pane failures | Add clear retry/fallback states with bounded backoff and an explicit return to full mode. Do not auto-reload healthy panes or reset a user's pause/volume choice. |
| 32 | Keyboard and accessibility audit | Preserve focus through keyed updates, expose loading/error state, test sliders and resizing without a mouse, and respect reduced motion. Add real screen-reader checks rather than relying only on attribute assertions. |
| 33 | Session export/import | Offer validated, versioned local backup and import. Reject unknown/unsafe fields and oversized files; allow preview before replacing saved sessions. |
| 34 | Better low-width layouts | Test 2/4/6 panes, browser zoom, long channel titles and popup menus. Hide only optional controls when space is limited; keep core playback/audio actions accessible. |
| 35 | CSS paint-cost review | Profile large shadows, blur and frequently repainted surfaces. Apply containment only where it will not clip menus or break fixed-position native players. |
| 36 | Lazy feature activation | Instantiate enhancements only when enabled and a target exists. Consider deferred source loading after measuring startup; keep extension CSP and local packaging intact. |
| 37 | Maintain a compatibility fixture library | Store sanitized captures of supported Kick markup variants and failure states, including offline channels and header/chat replacements. Keep captures free of private chat, account tokens and personal data. |
| 38 | Precise user-facing diagnostics | Distinguish blocked framing, autoplay refusal, offline channel, network failure and codec failure. Provide a useful action without exposing implementation details or sensitive URLs. |

## Order of work

The next implementation batch should be **diagnostics → control-state diffs →
keyed directory/picker updates → layout phases → dirty-row budgeting**. Those
target recurring work in the current source. Then benchmark player startup and
resource policies. Bigger module moves should follow actual ownership boundaries,
not just reduce the controller's line count.

No blanket tracker-domain blocking, automatic decoder/quality changes, framework
migration, new backend, or GPU service is needed for this roadmap. Treat them as
separate decisions with evidence and user-visible tradeoffs.

Relevant platform references:

- [Avoid layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing): batch geometry reads and writes, then inspect traces rather than assume a gain.
- [Video frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback): a possible measurement tool for presented frames, not a way to accelerate decoding.
- [Extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage): storage is asynchronous; coalescing here reduces redundant work and event traffic, not a claimed `storage.local` writes-per-minute quota fix.
