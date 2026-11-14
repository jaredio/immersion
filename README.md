<p align="center">
  <img src="docs/immersion-banner.svg" alt="Immersion: Kick multistream with Ice Poseidon, xQc, and Adin Ross" width="100%">
</p>

<p align="center">
  A more considered way to watch <a href="https://kick.com">Kick</a>.
  <br>
  Available for Firefox, Chrome, and Edge.
</p>

<p align="center">
  <a href="https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-firefox.zip"><strong>Download for Firefox</strong></a>
  &nbsp; &middot; &nbsp;
  <a href="https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-chrome.zip"><strong>Download for Chrome / Edge</strong></a>
  &nbsp; &middot; &nbsp;
  <a href="https://github.com/jaredio/immersion/issues">Feedback &amp; issues</a>
</p>

---

Immersion gives Kick a cleaner look and a more flexible way to watch. Channel details, goals, chat notices, polls, and predictions share a consistent dark design, with accents you can make your own.

Bring several streams into one page, arrange the layout, and save your setup for next time. Focus a stream to switch its chat and audio, with your chosen volume carried across. Turn on Mix audio when you want to hear more than one.

Search for channels, clips, and recordings, then drag them into your viewing space. Kick's native players, chat, and channel controls stay part of the experience.

Alt+K opens a floating search window. Move it by its title bar, resize it from the
bottom corner, or use arrow keys while either handle is focused. Position and size
stay with the tab; the reset button centers the window. Channels, Clips and VODs
have visible filters alongside the advanced query syntax. Drag a result into the
workspace, drop it back onto search to cancel, or press Shift+Enter to watch together. Returning a drag keeps the query and results open.

Kick's native search bar opens this same panel beneath the bar, with the same
channel, clip and VOD filters and actions. Alt+K moves it into the
floating window without losing the query or results. Escape or clicking outside
closes the attached panel. Disabling Immersion restores native search handling.

## Get started

<details>
<summary><strong>Firefox</strong></summary>

1. [Download the Firefox package](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-firefox.zip).
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select the downloaded ZIP.
4. Open or refresh Kick.

Requires Firefox 142 or newer. This development install lasts until Firefox restarts.

</details>

<details>
<summary><strong>Chrome / Edge</strong></summary>

1. [Download the Chrome / Edge package](https://github.com/jaredio/immersion/raw/refs/heads/main/dist/immersion-chrome.zip) and extract it.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
4. Open or refresh Kick.

</details>

You'll find **Immersion** at the bottom of Kick's sidebar. Make it yours from there. To apply an update, reload the extension and refresh Kick.

See the [0.13.0 release notes](docs/releases/0.13.0.md) for changes, validation and rollback details.

## Made to be yours

Your preferences and saved viewing sessions stay in your browser. Immersion has no analytics or custom backend.

Known analytics and marketing trackers on Kick are blocked by default. You can turn **Block Kick telemetry** off in settings; refresh Kick after changing it. Playback, chat, login and payment services are outside the initial rules. This does not remove all first-party or player telemetry. See the [code and network audit](docs/code-audit.md) for scope, measured samples and remaining performance work.

Found something that feels off? [Open an issue](https://github.com/jaredio/immersion/issues) with your browser, what happened, and a screenshot if it helps. Kick changes often; real-world feedback keeps Immersion improving.

<details>
<summary><strong>Working on the project</strong></summary>

Requires Node.js 22+ and Python 3.

```sh
npm ci
npm run build
npm test
```

Source lives in `extension/`. Browser builds and installable ZIPs are written to `dist/`. See [maintenance and release checks](docs/maintenance.md) for the current behavior, supported validation commands and measurement limits. Additional browser checks are listed in [`package.json`](package.json).

The [upgrade roadmap](docs/upgrade-roadmap.md) describes the module boundaries,
completed performance work and prioritized next improvements. Shared DOM
subscription checks run with `npm run test:dom`. The [performance batch](docs/performance-batch.md) covers diagnostics, repeatable benchmarks, per-pane player modes and total broadcast uptime.

</details>

---

<p align="center"><sub>An independent project. Not affiliated with or endorsed by Kick.</sub></p>

Lifecycle modules, chat picker fixes and soak checks: [lifecycle batch](docs/lifecycle-batch.md).

Channel Home, Videos, Clips, Schedule and About views share the dark channel theme.
Native card links and action handlers stay in place; offscreen library cards can skip
rendering. Channel identities consolidate duplicate native headers, and portrait
avatars stay inside their circular frame.

Home, Browse, Categories and category detail pages now share the profile theme,
with a discovery navigation bar, a desktop featured-creator shelf, consistent
stream cards and responsive category grids. Native player and filter controls
stay in place. See [discovery design notes](docs/discovery-batch.md).
