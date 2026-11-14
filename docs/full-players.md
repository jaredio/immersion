# Full Kick players (beta)

Multistream workspaces default to **Full Kick players (beta)**. Added streams load their complete Kick channel page
inside a player-only frame. The original channel keeps its existing player.

This retains Kick's native player controls and menus, including its timeline when
Kick provides one. It does not create DVR for broadcasts that don't offer it.
Focus still controls which stream is audible, and the selected volume carries
between streams unless audio mixing is enabled.

Choose **Manage** > **Player mode** to switch to **Standard embeds**. Full pages use more memory and network
resources, including the channel application's background work. The selected mode
is saved with the workspace and included in shared workspace links.

Full pages start two at a time. While a pane is waiting for a startup slot, its
**Use standard embed** button switches immediately without waiting for other
pages to finish. The same button is available if a page cannot load. The pane's header
also offers a switch back to an embed after loading, or a retry of the full player.
Switching the workspace mode reloads added players. Kick's framing protections
are respected; this mode does not modify response headers.

## Verification

- `npm run test:full-players`: Chromium extension integration with local fixtures.
- `npm run test:queued-player`: immediate queued fallback, cancellation, retained
  frames and keyboard focus; also supports `KR_ENGINE=firefox`.
- PowerShell: `$env:KR_ENGINE='firefox'; npm run test:full-players`: Firefox engine
  integration with the same content scripts injected by the test harness.
- `npm run test:full-players:live`: optional anonymous test against two real Kick
  pages in a disposable Chromium extension profile. Set `KR_LIVE_CHANNELS` to two
  comma-separated live channel names. This does not access your browser session.

The fixture test covers page isolation, native menus and seeking, focus audio,
volume carryover, player replacement, blocked-frame recovery, and cleanup.
The live check separately reports whether actual playback was proven; offline
pages or unavailable broadcasts do not count as a successful playback test.
