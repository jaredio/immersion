# Clip studio · 0.11.0

Clipping opens in one workspace-owned dialog with streamer identity, avatar,
broadcast title, source selection and a profile link. A single same-site Kick
frame owns the native clip provider. Existing stream tiles stay mounted and
never acquire or control its preview video. Closing, retrying or switching a
source unloads that frame rather than retaining hidden players.

Live moment fills the editor viewport. Native title, preview, cropper, publish,
success and download controls remain connected to Kick. Additional tools provide
duration presets, in/out seconds, selection nudges, reset, replay, playback speed,
keyboard controls and per-channel title/length drafts. Drafts contain no footage,
expire after seven days and are bounded to twenty channels.

Stream history lists accessible recordings, including a current-stream archive
when Kick exposes one. A pasted same-streamer replay link is also supported.
The full replay timeline has timestamp fields, draggable selection handles,
full-stream/ten-minute/two-minute zoom and real Kick thumbnail sheets when the
replay advertises a supported media URL. It does not invent or recover missing
recordings. The source duration comes from the media element or Kick's accessible
native timeline, so an IVS element without a finite duration cannot strand the UI.

Historical preparation uses Kick's own `openClipCreator` VOD event, verified in
its current public player scripts. Its provider starts the source window 150
seconds before the supplied position; the bridge supplies selection start +150,
then applies the requested local range through native cropper gestures. No React
trees are traversed or modified. Publishing remains an explicit native button
action; downloading uses Kick's post-publication controls. These behaviors depend
on Kick continuing to expose its native event and cropper selectors.

Validation:

- `npm test` covers bounds, replay URLs, timestamps, thumbnail sheets, bridge
  validation, transport and exclusion of preview videos from workspace commands.
- `npm run test:clip-studio` supports `KR_ENGINE=firefox` and exercises presets,
  numeric trimming, drafts, native publish/download fixture actions, repeated
  source changes, clips two hours into a replay, history/edit transitions and
  responsive sizing, including a non-collapsing mobile timeline.
- `npm run test:clip-studio:installed` loads the actual Chromium extension and
  checks content-script/MAIN-world integration and the native historical request.
- Full-player and browser regression suites cover retained players and workspace
  controls. Authenticated publishing against a real Kick account is not automated.

Reload the extension and refresh existing Kick tabs after installing this build.

## Recording discovery · 0.11.1

Kick's current recording models use a top-level video `id`, a `channel` object,
durations in seconds, and `livestream.vod_id` for the ongoing archive. The picker
reads these public models from the channel page's streamed server data, alongside
rendered recording cards. Legacy `video.uuid` API responses remain a fallback.
The current channel page can seed the live recording immediately. Native profile
data takes precedence over legacy API IDs so the same broadcasts do not appear
twice under different identifiers.

If normal requests are blocked, the existing clipping-frame slot can load the
native channel Videos page and report its public recording data. Only that named
frame, exact origin and per-load token are accepted. The frame is replaced with
the selected recording, preserving the single-frame limit. Readiness is reported
at DOMContentLoaded rather than waiting for all third-party page resources.

Failed discovery displays an actionable error rather than declaring that no
recordings exist. Retry restarts discovery. Timeline controls remain hidden
until a source is available. `test:clip-discovery` exercises current server data,
live-first selection, multiple recordings, blocked APIs/requests, native-page
fallback, legacy-ID deduplication and retry in Chromium and Firefox.

## Preview, mouse gestures and startup · 0.11.2

History preview styling now fills the native player root and every ancestor
between it and the video. Native maximum widths/heights are removed, including
the outer player's height limit. The source video stays in place, retains its
aspect ratio and follows the available iframe viewport when the window changes.

The timeline's two handles now trim independent endpoints within Kick's 10–180
second limits. Previously both handlers translated a fixed-length range.
Dragging the highlighted middle moves the selection while preserving duration.
The clip window itself can be resized from every edge/corner and moved by its
title bar. The bottom-right grip and title bar also support arrow keys; double
clicking either resets window geometry. Geometry stays within the viewport and
resizing never reloads or reparents the source iframe.

For live broadcasts with public source metadata, a hydrated channel can request
the native clip provider directly using its canonical web-video ID. This avoids
waiting for IVS initialization and the player's clip button. It retains the
native-button fallback for other layouts and shows separate channel-loading and
server-preparation states. No background player is preloaded. Authentication and
server clip generation remain controlled by Kick.

The editor browser suite covers constrained nested player wrappers, independent
mouse trimming, selection dragging, actual mouse window resizing without reload,
and live preparation when no native clip button exists. A live public jjstream
check verified full native preview geometry and reaching the unauthenticated
clip gate before the native player controls were present.


## Floating window and compact editing - 0.11.3

Clip Studio uses a nonmodal dialog in a manual popover. The top layer keeps it
above fullscreen players without darkening the page or making the document
inert. Outside clicks leave the editor open and let the page receive input.
Closing unloads its clipping frame; reopening retains the window geometry.
The title bar and all eight resize edges still work without reloading the frame.
The title bar and corner grip support keyboard movement and resizing, and a
double click resets the window to its centered default size.

Live moment now keeps its nested native form in normal vertical flow. The
preview has a usable minimum height, the title and timeline cannot collapse
under flex pressure, and overflow scrolls within the editor. Native Publish and
Cancel share one compact action row. The native form, cropper and backend
handlers stay connected.

The clip-studio browser suite checks background interaction, transparent
backdrop/nonmodal state, movement without a frame reload, geometry persistence,
and non-overlapping preview/title/timeline/tools in a nested native mobile-form
fixture at 750x700, 560x540 and 430x850. It runs in Chromium and Firefox.


## Replay timeline upgrade - 0.11.4

Stream history now opens on a two-minute editing window. Scrolling the wheel
zooms around the timestamp beneath the pointer without changing the clip range.
Shift + wheel pans; the scrollbar navigates the recording while zoomed in.
Zoom buttons, full-stream presets, Fit selection and Center selection provide
keyboard-accessible alternatives. The ruler changes its tick spacing with zoom,
and out-of-view selection handles and playheads are hidden instead of being
clamped to misleading positions at the edges.

The filmstrip and hover preview use Kick's real thumbnail sheets, including the
current player's rendered thumbnail URL. The dedicated clipping frame reads its
native preview image without moving it or touching React state, and observes
source changes as the native player loads. The parent validates the media host
and sheet path and retains the per-frame token on source messages. Legacy
HLS-derived thumbnail URLs remain supported. No playback requests are intercepted
or duplicated. Thumbnails retain Kick's sampling interval (typically one minute),
so these are navigation previews rather than frame-accurate thumbnails at every
zoom level. A missing or rejected source shows an unavailable state rather than
an endless loading strip.

Filmstrip refreshes are debounced during zoom/pan, use six to twelve cells, reuse
browser image caching, and never create another decoder or seek the main video.
Unit tests cover cursor anchoring, view limits, signed templates and sheet cells.
Chromium/Firefox browser tests cover real wheel events, panning, unchanged trim
points, loaded hover images and existing clipping actions. The installed Chromium
suite verifies native image discovery and source updates across isolated worlds.


Replay readiness now waits for a usable native duration, not just a video node.
Some IVS elements have NaN duration while their slider is created later, so the
frame also observes new slider controls and their duration attributes. Duplicate
source states are suppressed, including those caused by unrelated chat images.
The installed test models a late slider and native preview image; the editor
suite checks that missing thumbnail sheets show an unavailable state without
disabling clipping, and that newly available sheets recover.

A real installed Chromium check on jjstream's completed broadcast loaded nine
filmstrip cells and a hover thumbnail from Kick (HTTP 200) and exercised cursor
wheel zoom. The ongoing broadcast did not expose usable sheets during this
check. Native IVS playback and authenticated publishing are separate from this
thumbnail validation.
