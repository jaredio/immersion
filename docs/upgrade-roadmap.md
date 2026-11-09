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

## Delivered performance batch: items 1-12

Items 1-12 now have implementations and regression coverage. See the
[performance batch](performance-batch.md) for behavior, benchmark commands,
measurement limits and the total-stream-time fix.

| # | Delivered upgrade |
| --- | --- |
| 1 | Opt-in bounded local diagnostics and export |
| 2 | Foreground and genuine-background fixture matrices |
| 3 | Cached native-control discovery with structural invalidation |
| 4 | Keyed channel-directory cards |
| 5 | Content-keyed chat/session/suggestion menus |
| 6 | Unchanged icon/text/attribute/style write suppression |
| 7 | Scheduled geometry reads before layout writes |
| 8 | Shared weak row/anchor indexes and per-row record lookup |
| 9 | Cooperative dirty-row budgets with resumable queues |
| 10 | Differential frame status with revision acknowledgements |
| 11 | Prioritized, cancelable two-player startup queue |
| 12 | Saved/shared per-pane full/embed choices |

## P2 — reliability and code quality

| # | Upgrade | Reason and acceptance evidence |
| --- | --- | --- |
| 13 | Delivered: extract remaining controller responsibilities | Move chat mounting/picker behavior, stream-tile lifecycle, and clip placement into modules with small callback interfaces. Keep one orchestration owner for active workspace state and audio focus. |
| 14 | Delivered: explicit player phases and playback | Encode queued/loading/retrying/ready/blocked/offline/failed/disposed phases separately from playback. Reject replaced generations and exercise repeated mode changes and disposal. |
| 15 | Delivered: structured lifetime scopes | Give each workspace/pane a disposal scope owning event listeners, observers, timers, animation frames and pending jobs. Teardown should be idempotent and leave no retained frame references. |
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

The performance foundation in items 1-12 is delivered. Use diagnostics and
repeatable samples to identify the next bottleneck. The next architecture batch
is remaining chat/tile ownership (13), explicit lifecycle states (14), and unified
resource disposal (15), followed by request/storage robustness. Preserve one
owner for each resource and avoid refactoring purely to reduce line counts.

No blanket tracker-domain blocking, automatic decoder/quality changes, framework
migration, new backend, or GPU service is needed for this roadmap. Treat them as
separate decisions with evidence and user-visible tradeoffs.

Relevant platform references:

- [Avoid layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing): batch geometry reads and writes, then inspect traces rather than assume a gain.
- [Video frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback): a possible measurement tool for presented frames, not a way to accelerate decoding.
- [Extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage): storage is asynchronous; coalescing here reduces redundant work and event traffic, not a claimed `storage.local` writes-per-minute quota fix.
