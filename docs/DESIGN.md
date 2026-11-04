# Weather Board: Material 3 Expressive

The November 2026 retouch uses Google’s Material 3 Expressive guidance as the primary reference. Explore weather, saved reading search, the reading editor, location history, and connection setup share typography, color roles, and adaptive navigation. These are custom web components, not Google-certified Material components.

## Primary-source study

The Material site is JavaScript-rendered. Its guidance was opened and read in the browser, including component guidance and specifications rather than only the launch article.

| Guidance reviewed | Applied decision |
| --- | --- |
| [Building with M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive) | Reserve strong expression for the welcome illustration and current weather. Simplify archive summaries and keep data areas quieter. |
| [Color roles](https://m3.material.io/styles/color/roles) | Use matched primary/on-primary, container/on-container, and surface roles. Navigation, search, forecast rows, dialogs, and body content occupy different tonal levels. |
| [Shape overview](https://m3.material.io/styles/shape/overview) | Combine 32/48px containers, asymmetric corners, and a condition-responsive weather shape. Avoid arbitrary ornament on every section. |
| [Typography overview](https://m3.material.io/styles/typography/overview) | Google Sans Flex with emphasized display weights and roundness for the main number and headings; smaller neutral body labels; code face only for IDs and API diagnostics. |
| [Button groups overview](https://m3.material.io/components/button-groups/overview), [specs](https://m3.material.io/components/button-groups/specs) | Connected units and measurement groups have 2px gaps, rounded outer ends, and selection-dependent shape. Controls retain at least 48px targets. |
| [Search overview](https://m3.material.io/components/search/overview), [guidelines](https://m3.material.io/components/search/guidelines) | Persistent, contained search with contrasting surfaces. Matches appear in a contained floating popup after a 450 ms pause and three characters, with region/country details. Arrow keys and Enter select an option while focus stays in the combobox; Escape dismisses it. A close action returns focus to the field. |
| [Navigation rail](https://m3.material.io/components/navigation-rail/overview) | Weather and Your API remain consistent destinations. Expanded screens use a rail; compact screens use a bottom bar with the same color roles. |
| [Motion principles](https://m3.material.io/styles/motion/overview/how-it-works), [web specifications](https://m3.material.io/styles/motion/overview/specs) | Spatial shape/press transitions use expressive spring-like curves. Color changes use non-overshooting effects. Reduced-motion preferences remove animation. |
| [Google’s expressive design research](https://design.google/library/expressive-material-design-google-research) | Treat emphasis as a hierarchy tool. Make the next action apparent while preserving familiar interaction patterns. |

This study replaces the previous general inspiration survey as the basis for the current implementation. It does not claim a new external user study or visual audit of third-party app catalogs.

## Screens and hierarchy

**Explore weather** replaces the synthetic Demo. A single search entry supports cities, towns, and postal codes; a secondary coordinate form supports places outside named settlements. Provider requests are explicit. The initial welcome has a geometric sun/cloud composition. Selecting a place replaces it with current temperature, condition, local time, and three compact measurements. A continuous hourly chart and a seven-row daily list sit below. Provider attribution, unit conversion notes, and request usage stay discoverable.

**Your API** replaces Live API. It opens on a clear connection form instead of fetching from a previously saved URL. Connected Readings, History, and Connection views share a connected view switcher. The saved reading summary is compact; cards emphasize location and measurements. Search matches are list rows, with direct ID lookup retained as an explicit alternative.

**History** has its own page space rather than being appended below a long reading feed. Temperature, humidity, and wind are connected controls. Location, date, and unit controls use filled surfaces with persistent labels. One chart changes measurement; the semantic table supplies precise values. Counts describe loaded pages, and further requests require Load older readings. Missing measurements break chart lines instead of implying zero.

**Reading editor** uses the same tonal hierarchy, filled fields, condition selection, and clear save action. It is a side sheet on expanded windows and a bottom sheet on compact windows. Focus is contained while open; its background is inert; Escape, scrim, and Close dismiss it and restore focus. Closed sheets are hidden and inert.

## Implementation

- `web/platform.css` defines shared roles and typography. `web/explore.css` supplies common navigation, connected buttons, search rows, forecast layouts, and compact adaptations.
- `web/palettes.js` retains generated light/dark Material color roles. Conditions choose the palette. Surfaces and corresponding foreground roles are paired.
- `web/workspace-base.css` retains the original editor, loading, and API inspection primitives. `web/workspace.css` retouches their layout and hierarchy.
- `web/open-meteo.js` isolates coordinate validation, WMO condition mapping, and a bounded forecast query. UTC epoch timestamps are formatted using the returned location timezone.
- `web/request-policy.js` shares browser limits across both screens. It caches bounded weather/geocoding responses, coalesces duplicate reads, persists request counts and 429 cooldowns, uses Web Locks where available, and does not retry automatically. Browser limits are explicitly described as bypassable controls, not a spending guarantee.
- No frontend framework or build step is required. Serve `web/` over localhost or HTTPS. Licensed Latin/extended-Latin Google Sans Flex and Google Sans Code plus a small Material Symbols subset are served locally from `web/fonts/`. Other scripts use system fallbacks. Only provider data needs internet. `scripts/vendor_fonts.py` records asset sources and hashes and retains the font licenses.

## Verification

The change is checked with Python handler tests, Node tests for history and request policy, and browser flows against a local API. Visual review covers desktop and compact layouts, light/dark modes, location results, forecasts, history, and the reading editor. Tests include delayed responses, provider failures, cache reuse, request exhaustion, zero startup API calls, unit changes without requests, and explicit connection/disconnection. Live Open-Meteo requests verify the integration separately from deterministic fixtures.
