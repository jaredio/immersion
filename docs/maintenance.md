# Maintenance and validation

Runtime source lives in `extension/`. The current module boundaries and remaining
proposals are in [the roadmap](upgrade-roadmap.md). The dated
[network audit](code-audit.md) records historical measurements, not current live
stream CPU performance.

## Current behavior

- Clip Studio is removed. Native clip creation and chat clip playback remain.
- Focus aligns the right column with the featured player's bottom and balances
  overflow panes into wider rows below. A five-stream setup uses two panes beside
  the main player and two below at the default split. Existing player instances
  are retained; videos remain contained without cropping or stretching.
- Metadata runs at most two channel reads concurrently; queued removed channels
  and late teardown results cannot update the workspace.
- Clip, X, and media previews each enforce two retained previews per message,
  including links inserted before existing ones. Dirty-message cleanup avoids
  full retained-record scans except on DOM removal batches.
- Player isolation and playback share a structural observer. Reply previews
  observe their trigger and ancestor removal paths instead of page-wide text.
- Channel and search responses stop at 2 MiB of streamed bytes. Pending reads
  honor cancellation and split UTF-8 characters are decoded correctly.
- Channel directory/profile ownership is separate from playback orchestration.
  Switching channels replaces the inline schedule and ignores stale load events.
- Named sessions have stable IDs; legacy names receive deterministic IDs when
  read. A background owner serializes upsert/delete operations across tabs.
  Ordinary workspace autosaves never replace the shared saved-session list.
  Storage events synchronize menus, and older replies cannot undo newer updates.
- Leaving the Schedule tab removes its iframe. Returning loads a fresh schedule;
  the previous calendar navigation position is not retained.
- Partial search failures expose Retry without discarding successful results.
  Retry reissues only failed channel requests at their existing pagination cursor.
- Settings changes from the popup and Kick tabs are serialized as field-level
  patches in the background. Local edits remain visible while a save is pending;
  failures restore committed values and show an error. Concurrent edits to the
  same field intentionally use the last committed patch.
- X Retry bypasses only failed cache entries. Retry controls indicate loading,
  prevent repeat activation, and restore keyboard focus after recovery.
- Preview jobs have per-message/frame leases. Removing a requesting card or
  disabling its feature releases its lease; closing a tab releases its leases.
  A queued job is removed or a running job aborted only after its last consumer
  leaves. Canceled work never populates the failure cache. Cache and queue caps
  and the two-request-per-provider concurrency limit remain in place.
- Failed channel/panel metadata expires after five seconds, preserving previous
  successful data. A new interaction can retry once that interval has elapsed;
  no permanent polling loop is added.
- Session Save/Delete controls show pending state and block duplicate activation.
  Old watch/save errors clear after a successful retry. Toggling profile previews
  preserves existing YouTube/TikTok players if their media setting is unchanged.

## Build and release

The cleanup removed unused control styles, the permanently hidden speaker badge,
unused internal arguments, the old Clip Studio frame guard, and orphaned editor
HLS fixtures. Playback HLS fixtures remain in use. Overlapping review notes were
consolidated here; historical network measurements remain in the network audit.

`npm run build` synchronizes generated top-level assets and packages only the
inventory from `tools/release-files.mjs`. Browser caches and stray nested files
never enter ZIPs. Chrome omits the Firefox-only support background hook; Firefox
omits the Chrome background wrapper. Source for both targets remains maintained.

`npm run test:release` plants disposable stale assets, rebuilds, and verifies both
ZIP inventories exactly. Do not add runtime assets without updating the release
inventory when they live outside the source root.

## Checks

| Command | Purpose |
| --- | --- |
| `npm test` | Unit and boundary checks |
| `npm run test:browser` | General Chromium and Firefox integration |
| `npm run test:full-players` | Native controls, frame replacement, fallback |
| `npm run test:focus-layout` | Packing, resize, iframe retention, four-stream split |
| `npm run test:review-fixes` | Metadata, schedules, incremental preview limits and cleanup |
| `npm run test:clips` | Playback, transfer, workspace placement, media leases |
| `npm run test:reply-preview` | Quote edits, unrelated text, recycled rows, removal |
| `npm run test:workspace-soak` | Repeated lifecycle/resource cleanup |
| `npm run test:release` | Stale build assets and package inventory |
| `npm run test:session-sync` | Installed Chromium multi-tab session saves, live sync and stable selection |
| `npm run test:retry-ux` | Retry loading/focus, removed-card cancellation, watch-error recovery |
| `npm run test:queued-player` | Immediate queued fallback, canceled startup, retained frames and focus |

Most feature browser runners support `KR_ENGINE=firefox`; see their entry points.
Other feature checks are listed in `package.json`.

## Measurement limits

The targeted cleanup benchmark retains 60 previews and changes one message 20
times. X/media inspections decreased from 1,200 to 20 per feature. The clip
runner also records 20 checks. These counters are not whole-browser CPU savings;
removal-heavy batches retain conservative pruning.

Run `npm run benchmark:chat-cleanup`, `benchmark:workspace`, or
`benchmark:background` for local fixtures. Results stay under ignored `artifacts/`.
`benchmark:live-players` uses a disposable anonymous profile and samples all
browser-reported processes plus summed Windows working sets. Shared memory may
be counted twice and exited processes are omitted. Live playback was not proven
in the last run, including an unrestricted retry, so its numbers describe page
loading rather than streaming. No existing user browser session is accessed.
