# Performance batch: roadmap items 1–12

## Delivered behavior

| Item | Implementation |
| --- | --- |
| 1. Local diagnostics | `performance.js` keeps bounded counters and timing samples only when enabled. Turn on **Local performance diagnostics** in settings, then **Export this tab’s diagnostics** in Kick's Immersion settings. Disabling clears the samples and disconnects the long-task observer. No request contents, URLs, chat text or account details are sent or recorded by this service. |
| 2. Repeatable benchmarks | `benchmark:workspace` exercises 1/2/4/6 panes, full/embed modes, grid/focus/columns and idle/busy chat, with configurable repeats and sample windows. `benchmark:background` uses native Chromium CDP and verifies real hidden-tab visibility. Both use an isolated profile and local fixtures. |
| 3. Cached control discovery | Native controls are discovered after relevant structural/label changes. Playback, audio, focus and clock updates reuse the discovered controls. Native React replacement restores exactly one unified control row. |
| 4. Keyed directory | Cards retain their outer identity by channel; unchanged cards retain their contents, focus and open details across unrelated updates. Only changed data/expanded content is rebuilt. |
| 5. Incremental pickers | Chat options/tabs, native chat picker options, saved-session options and suggestions rebuild only when their displayed content changes. Selection is updated independently. |
| 6. DOM write suppression | Workspace icon rendering is cached. Repeated audio/playback states skip unchanged text, attribute, slider and style writes; native control state and clock updates also avoid redundant writes. |
| 7. Layout phases | Geometry is read before rail, overlay and control writes. Rendering schedules a frame instead of measuring synchronously. A changed rail can schedule a correction frame; unchanged geometry does not keep scheduling corrections. |
| 8. Shared row index | Chat subscribers receive shared affected-row sets and use a weak row-to-anchor cache. Relevant mutations invalidate the row cache. Container changes, including disabling all chat subscriptions, reset the index. Per-feature row-to-record indexes replace repeated linear record searches. |
| 9. Cooperative chat budget | Each enhancement processes at most 24 dirty rows or about 4 ms of row work before yielding. Pending rows stay queued and resume in a subsequent task. This cannot preempt one expensive row or garbage collection; it is not a hard real-time deadline. |
| 10. Status differences | Player frames compare meaningful status fields before sending. New command revisions still receive an acknowledgement, including unchanged-state forced commands. Clock ticks and hidden native text counters do not trigger whole-player rediscovery. |
| 11. Startup queue | Two startup slots gate added full players until readiness or timeout; already-ready Kick pages can continue their own background work. Focus/audio selection can prioritize queued panes. Removing/replacing panes cancels queued work; readiness, offline state or a load timeout releases the slot. The retained native player bypasses this queue. |
| 12. Per-pane modes | The pane switch works in both workspace modes. Choices are normalized, stored with sessions and included in shared links. Changing the workspace-wide mode resets pane overrides. Temporary error fallback remains distinct from a saved mode choice. Full Kick is still the default. |

## Stream timer fix

Live-player elapsed time now means **total broadcast uptime**. Channel metadata
provides the stream start time; the parent sends the validated timestamp to
added players. A shared clock utility handles explicit timezones and Kick's
timezone-free UTC timestamps. Each document has at most one clock interval for
its active control rows.

Pausing, seeking, reloading a pane or switching player mode does not reset uptime.
An unknown/invalid start time leaves the timer hidden rather than substituting
`video.currentTime`. Existing narrow-layout rules can still hide the timer when
there is insufficient room. Clip/VOD playback timelines are unchanged.

## Diagnostics scope

Counters include page refreshes, chat batches/index builds/processed rows,
workspace renders, changed directory cards/pickers/icons, control discovery,
layout passes, storage writes, issued channel/search requests, frame commands and
received messages, startup counts and peak startup concurrency. Timing samples
are bounded to 256 entries per metric; metric counts are also capped.

Exports describe the current document. Frame message counts are observed by the
parent; independent child-document timing samples are not a whole-browser
profiler. `page.longTasks` covers the observed page, including Kick's own work,
and is not attributed solely to Immersion. Diagnostics add measurement overhead
while enabled and are off by default.

## Running the fixture matrix

```powershell
npm run build
npm run benchmark:workspace
npm run benchmark:background
```

Both commands default to two repetitions across all four counts, both modes,
three layouts and two chat states. The foreground runner uses Playwright with
the installed extension. Playwright emulates focused pages, so the separate
background runner launches a disposable headless Chromium directly through CDP,
without focus emulation. It asserts `document.visibilityState === 'hidden'`
before sampling. There is no need to open or use a personal browser profile.

Supported options, for example:

```powershell
$env:KR_BENCH_COUNTS = '1,2,4,6'
$env:KR_BENCH_MODES = 'full,embed'
$env:KR_BENCH_LAYOUTS = 'grid,focus,columns'
$env:KR_BENCH_CHAT = 'idle,busy'
$env:KR_BENCH_REPEAT = '3'
$env:KR_BENCH_MS = '2000'
npm run benchmark:workspace
```

Results go to ignored `artifacts/workspace-benchmark.json` and `.md`, and
`artifacts/workspace-benchmark-background.json`. A foreground report basename
can be selected with `KR_BENCH_NAME`. Background throttling can reduce synthetic
chat production; the native report records actual `chatMessages`.

The fixtures use silent WAV media. They validate scheduling, DOM behavior and
extension workload, not live Kick's full application cost, video decode speed,
DVR support or a guaranteed speedup. CDP duration and heap metrics apply to the
main target, not every browser process; cross-site embed renderers may be
separate. Counters include setup; duration deltas cover the observation sequence.
Use repeated real-channel/hardware measurements before making performance claims.

## Regression coverage

- `npm test`: timestamp parsing, unknown/invalid clocks, bounded opt-in diagnostics,
  startup priority/concurrency/cancellation, per-pane state validation and existing
  feature tests.
- `npm run test:player-controls`: real browser checks for total uptime, cached
  discovery, idle updates, native replacement and teardown. Supports
  `KR_ENGINE=firefox`.
- `npm run test:dom`: shared indexing, per-feature mutation filters, container
  replacement, bounded draining and observer disposal in Chromium/Firefox.
- `npm run test:full-players`: broadcast time through actual frame messaging,
  stable directory/chat-option identity, full/embed switches in either direction,
  native menus/audio and cleanup. Supports `KR_ENGINE=firefox`.
- Existing workspace, clip, media, privacy and installed-Firefox checkout suites
  remain part of the affected regression checks.

The remaining architecture/product work is tracked as items 13–38 in the
[upgrade roadmap](upgrade-roadmap.md).
