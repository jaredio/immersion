# Code and network audit — November 7, 2026

Follow-up: shared DOM subscriptions and the first multistream module split are
now implemented. See the [upgrade roadmap](upgrade-roadmap.md) for current
module ownership, completed work and the prioritized remaining improvements.

## Scope and result

Reviewed extension entry points, build/packaging, settings, network workers,
multistream lifecycle, player isolation, chat enhancements and their tests.
This is a cleanup and performance pass, not a claim that Kick's proprietary
application or every future site change has been audited.

## Fixed

| Finding | Change |
| --- | --- |
| Full-player isolation rescanned the page when Immersion updated its own clock and labels. | Ignore mutations within the unified control row and chat; isolation scans respond to element structure changes. Native player/control replacement remains supported. |
| Player frames continued scheduling work after teardown. | Disconnect the observer and cancel pending scan/status timers on final pagehide. Preserve observers on back/forward-cache pagehide. |
| Popout chat's once-only pagehide listener could be consumed by a cached navigation. | Keep the listener across cached navigation; explicitly release settings listeners and guard late settings reads after disposal. |
| Main-page settings listener outlived its controller. | Name and remove the listener during disposal. |
| Media visibility callbacks searched every card for each entry. | Use weak host-to-record indexes, with explicit deletion when cards are released. Restore visibility observation after a successful manual X-card retry so offscreen video cleanup works again. |
| Multistream retained an obsolete second channel/panel fetch implementation. Its timeout controllers could not cancel requests owned by the shared service. | Remove the duplicate parser/fetch branches and ineffective controllers. The existing shared channel service owns validation, deduplication and request timeouts. |
| Multistream metadata caches grew with every channel visited. | Bound both caches to 60 entries and clear them at destruction. |
| Shared links still used an older default focus width. | Read the normalized current default rather than keeping a second numeric default. |
| Unused modal-workspace styles survived the switch to an inline workspace. | Remove the unused open-dialog rule and rules for elements no longer emitted. |
| One metadata worker implicitly loaded another unrelated worker. | Add a small explicit background entry point; service modules no longer load one another. |
| Chromium writes compiled network-rule caches into the unpacked extension directory. | Exclude browser-generated `_metadata` from Git and release ZIPs. |
| Browser tests assumed standard embeds were still the default and checked frames before navigation completed. | Explicitly choose embeds in the general fixture suite and wait for the fixture video. Keep the full-player default covered by its dedicated suite. Use a fresh full-player test profile after worker-entry changes. |

## Telemetry protection

The new **Block Kick telemetry** setting defaults on. Rules use the browser's
declarative network engine, restricted to requests initiated by `kick.com` and
its subdomains. Immersion does not intercept request bodies or keep a browsing log.
The setting and the main Enable Immersion switch control the rules. Refresh
existing Kick tabs after changing protection: blocking a loader cannot unload a
script that already ran.

An anonymous live trace showed Google Tag Manager/Analytics, Datadog RUM,
TikTok, Meta and Quora trackers. The 12 initial rules target those analytics
destinations and specific marketing collection paths. They do not match direct
top-level navigation, media or websocket resource types.

The rules deliberately leave Kick APIs, livestream delivery, chat sockets,
reCAPTCHA, Stripe, consent management and embedded media providers available.
For example, `/api/v1/analytics/leaderboard` is functional site content, so the
word “analytics” alone is not a reason to block a request.

This does **not** remove all telemetry. First-party event reporting, player
quality metrics, Datazoom/Mux integrations and advertising remain outside the
initial rules. Those need separate dependency and playback testing. Hiding a
React component also does not stop its requests, timers or socket subscriptions.
No global `fetch`, socket or `sendBeacon` monkeypatch is used.

The extension now requests `declarativeNetRequest`; the updated permission may
be shown by the browser when installing/updating. No all-sites host permission
was added. API references:
[Chrome](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest),
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest).
Kick describes its collection in its [privacy policy](https://kick.com/privacy-policy).

## Measured sample

Two separate anonymous Chromium processes opened `xqc`, with the same extension
and a 15-second observation period after DOMContentLoaded. Only the telemetry
preference changed. The report records host counts, not cookies, bodies or URL
queries.

| Metric | Protection off | Protection on |
| --- | ---: | ---: |
| Attempted requests | 291 | 257 |
| Requests explicitly blocked | 0 | 3 |
| Encoded bytes reported by Chromium | 6,340,775 | 5,065,757 |
| Main-thread task duration reported by Chromium | 8.47 s | 6.75 s |
| JavaScript heap at observation | 69.4 MB | 62.3 MB |

These are individual live samples. Advertising, stream state, server responses,
network conditions and garbage collection vary. They are not an established
speedup or a whole-browser CPU/memory measurement. Headless video reported
`MEDIA_ERR_SRC_NOT_SUPPORTED` in **both** samples. A separate full-player live
check loaded and isolated its two channel pages, but both channels were offline.
Neither live check proves active stream decoding. Fixture playback, native
controls, quality menus, focus audio and frame replacement have separate tests.

Reproduce with `npm run audit:network`; optionally set `KR_AUDIT_CHANNEL` to a
public channel slug. Results go to ignored `artifacts/network-audit.json`.

## Best next improvements

1. **Choose a lighter player path when appropriate.** Full Kick players load a
   complete Next/React application per pane. Standard embeds are already
   available and are the architectural route to avoiding that duplicate app
   work. Keep the user's chosen Full Kick default. A future per-pane lightweight
   mode could be offered explicitly, with native feature differences explained.
2. **Profile real playback before adding more blockers.** Repeat on live channels
   in a browser capable of decoding their media. Measure dropped frames, startup
   time, long tasks and CPU at 1, 2, 4 and 6 streams. Keep login, chat, quality
   selection and checkout regression checks alongside privacy checks.
3. **Continue splitting the multistream controller by ownership.** View creation,
   frame messaging, layout lifecycle, metadata and session persistence now have
   separate modules. Chat mounting and stream/clip tile lifecycles are the next
   boundaries. Preserve the existing frame-session/revision protocol and one
   owner for each resource; avoid parallel implementations of the same API.
4. **Make mutation work local.** Document/chat subscriptions are now shared for
   content refreshes, chat media and notices. The next steps are shared row
   indexing, bounded processing per turn and keyed view updates. Keep chat-row
   parsing incremental and avoid periodic whole-page polling.
5. **Improve maintainability without a wholesale runtime rewrite.** Add a
   consistent formatter/linter and JSDoc contracts for player messages and media
   records. Much of the source is compressed into long lines. Better boundaries
   and readable functions will make lifecycle mistakes easier to spot than a
   framework migration would.

## Checks

`npm test`, `npm run test:privacy`, `npm run test:browser`,
`npm run test:full-players`, `npm run test:media`, `npm run test:clips`, and
`npm run test:channel-markup` cover the affected behavior. The Firefox UI engine
suite uses an explicit extension-API shim; the installed Firefox support suite
also exercises real telemetry blocking and preference changes against a local
HTTPS fixture, alongside provider forms. No payment is submitted.
