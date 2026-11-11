# Discovery design

The homepage, Browse livestreams/categories/clips, category detail pages and native
Following routes share the channel theme. For you, Live, Categories and Clips
navigation sits on the right of the native top navbar, before account controls.
It collapses into an Explore menu on narrower screens. There is no large
discovery masthead in the content area. The homepage keeps Kick's featured
player and exposes its existing featured-creator shelf on desktop. Category detail
pages retain local Livestreams/Clips tabs, Follow and description controls.

`discovery.js` applies reversible markers to native surfaces. `discovery.css` styles
stream cards, fixed circular avatars, category covers, section headings, grids,
loading placeholders and category identity panels. Native card nodes, menus,
filter controls, pagination and player instances remain mounted. The discovery
navigation forwards clicks to native links when available, preserving SPA routing;
modified clicks remain ordinary browser links.

The adapter runs through the existing page subscription. It adds no observer,
catalog requests, video previews, storage, polling or tracking. Unchanged refreshes
avoid DOM writes. It restores native attributes and removes its navigation on disable,
unsupported routes or native root replacement. Existing authentication and native
Following empty states remain owned by Kick.

`npm.cmd run test:discovery` verifies native actions and player identities, route
navigation, filter controls, avatar bounds, responsive grids, unchanged refreshes,
root replacement and restoration. Set KR_ENGINE=firefox for Firefox. Unit tests
guard route boundaries. Live read-only previews were inspected against Kick's
current Home, Browse, Categories and Just Chatting markup; live content, feature
experiments and authenticated Following layouts may vary. No claim is made about
real-world total CPU, network savings or all production account variants.

Home stream shelves use three columns in wide content areas, two at intermediate
widths, and horizontal rails on narrow screens. Native Show more/Show less state
still controls desktop row expansion. Other native stream rails receive the same
larger card proportions. Card footers put the stream title first, followed by a
creator byline with a bounded avatar, then a separate category/language/age row.
Section headings have no leading accent bars. Category art scales up and leaderboard
panels avoid nested outer boxes. The featured-player caption uses a matte surface.

The navbar adapter preserves native search and account controls, handles native
navbar replacement, and removes listeners on disposal. Regression checks cover
responsive menu navigation, Escape, active selection after replacement and source
player/card identity. The main content script tolerates a missing discovery module
during an extension update so an older manifest cannot interrupt the other features.
