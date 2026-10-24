# Live validation — October 23, 2026

An anonymous Chromium session loaded the unpacked extension against https://kick.com.

- Homepage: extension enabled flag present, sidebar present, ten recommended channel links detected.
- A native sidebar channel link navigated to `/zunday29`; native chat and sidebar remained present. Chat panel width: 340px.
- In-page settings dialog opened successfully.
- At a 390px viewport, document width was 390px and the extension control remained mounted.
- The initial toolbar placement crowded Kick's centered search. It was corrected by placing the toolbar inside the existing account action group, then visually checked on the live page.
- Kick's initial hydration could clear extension DOM flags. The script now initializes at document idle and restores flags after late hydration.
- Both the extension-enabled session and an independent browser without the extension produced the same site React #418 HTML hydration error. No evidence attributes that exception to the extension.

This is functional validation, not a playback latency benchmark. Live screenshots can contain public stream content. Synthetic fixture screenshots are better suited for sharing.
