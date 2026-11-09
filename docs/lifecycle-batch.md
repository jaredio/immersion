# Workspace lifecycle batch

Items 13–15 separate pane rendering from workspace policy and make resource
ownership explicit:

- `multi-chat.js`: native chat picker, avatar listbox, secondary chat mount/reset.
- `multi-stream-tile.js`: stream pane markup, controls and scoped UI events.
- `multi-stream-player.js`: iframe generations, startup leases, retry/fallback,
  bus registration and frame disposal.
- `multi-clip-tile.js`: clip UI, guarded media callbacks and single-release lease.
- `player-state.js`: idle/queued/loading/retrying/ready/offline/blocked/failed/
  disposed phases, with independent playing/paused/unknown playback status.
- `lifetime.js`: nested scopes; idempotent cleanup for events, timers, animation
  frames and arbitrary disposers. Children unlink when disposed. Aggregate counts
  retain no pane, channel, DOM or callback references.

The controller keeps channel selection, clip placement, layout and audio policy.
Native videos are still owned by Kick. Replacing a video cancels its old listeners
and scheduled status update; closing restores native styles, playback and chat.
Frame disposal cancels startup work and unregisters the bus before removing the
iframe. Status messages still require the current source, origin, session and
command revision. Mount generation checks also reject stale local callbacks.

The native chat picker uses a keyboard-accessible listbox with avatars, selected
state, arrow/Home/End navigation, Escape dismissal, and matching trigger/menu
widths. Its native chat stacking context sits above the secondary chat iframe.
Workspace chat iframes have a specific name; only these hide their duplicate chat
heading. Standalone popouts retain their heading. Header discovery uses the shared
DOM subscription and is disabled with the extension.

## Validation

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:full-players
npm.cmd run test:clips
npm.cmd run test:workspace-soak
$env:KR_ENGINE='firefox'
npm.cmd run test:full-players
npm.cmd run test:clips
npm.cmd run test:workspace-soak
```

The soak defaults to 24 cycles per browser; `KR_SOAK_CYCLES` changes that count.
It exercises full/embed switches, all layouts, chat selection, native video
replacement, same-document route changes, explicit closure, exclusive audio,
late callbacks and deliberately reentrant media release. It asserts that scope
and resource counts, observing instances, transport sources, startup jobs and
iframes return to the closed-workspace baseline every cycle. Final destruction
leaves zero lifetime scopes/resources. Reports go to ignored `artifacts/` files.

The soak uses real browser media with silent WAV fixtures and an explicit browser
API shim. Full-player and clip suites also exercise an installed Chromium build;
their Firefox counterparts use a shim. These checks do not measure real Kick
decode cost, total browser memory, cached back/forward navigation or extension
reload. They establish bounded ownership for the exercised lifecycle paths.

Secondary chats now retain their own native header controls. Only the duplicate
Chat title is hidden inside the popout frame; the parent native header controls
are hidden while its shared channel picker stays visible. Active-chatters popups
therefore belong to the selected frame, and switching back restores the original
controls. Browser regressions open/close a modal in secondary chat, interact with
other controls afterward, and verify main-chat action ownership after switching.
