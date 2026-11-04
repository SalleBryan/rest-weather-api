# Weather Board release plan

Requested 4 November 2026 by SalleBryan. Monthly AWS alert threshold: **US$3**, including hosting and this project's API. Alerts and best-effort throttles are not a hard spending cap.

## Scope and order

1. Research more than 150 distinct comparable platforms before implementation. Keep a dated, linked source registry; exclude duplicates, inaccessible pages, and unreliable sources. Distinguish source/navigation review from deeper visual review and hands-on tests.
2. Favorites and recent locations, stored locally with bounded lists and accessible management.
3. Clickable daily forecasts with hourly temperature/rain detail, using the existing fetched dataset.
4. Offline app access and saved forecasts with explicit timestamps, stale status, and intentional refresh.
5. Comparison of up to three locations, local units, clear timezones, and bounded explicit requests.
6. Explicit import of a model forecast into the connected Weather Board API, preserving provider, coordinates, and model timestamp. Preview before POST; never import automatically.
7. Refine all views using Material 3 Expressive: meaningful emphasis, variable typography, coherent tonal surfaces, connected controls, adaptive navigation, accessible sheets/dialogs, and reduced motion.
8. Verify tests and browser flows, then publish a static frontend to Amplify with minimal artifacts, no SSR/automatic builds/previews, security headers, and cost alerts.

## Hosting and security decisions under review

- User explicitly selected AWS Amplify. Existing AWS account and us-east-1 CLI credentials are available. Existing unrelated Amplify apps must remain untouched.
- A static manual deployment avoids hosted build compute and server rendering. Only frontend runtime assets belong in the deployment archive.
- Strict script/worker origins, frame protection, MIME protection, referrer policy, limited browser permissions, HTTPS, and explicit BYO connections are required. Never put credentials in the public artifact.
- Evaluate owner-only authorization on the existing anonymous CRUD API before publishing import functionality. A browser request counter is not API authentication.
- Reuse appropriate existing billing-notification destinations; keep email addresses and credentials out of the public repository.
- AWS WAF's Amplify integration has a fixed charge above the US$3 budget, before WAF charges. Do not add it as an assumed free safeguard.

## Progress

- Baseline: main commit `ac2c993`; working tree clean before this task.
- Preliminary source collection: 277 candidate URLs; 210 readable extracts, 27 thin/script-only extracts, and 40 fetch failures. Collection metadata is private under the local Codex research directory. These are collection results, not a completed visual review count.
- Review exclusions remove duplicate regional editions, ambiguous identities, retired/unreliable pages, and API-only catalogs. Final research counts and findings belong in `docs/research/README.md` and its registry.
- Primary AWS documentation and existing account budgets reviewed. User specified US$3 rather than the suggested larger thresholds.
- Research synthesis completed before app changes: 169 source/navigation reviews, ten closer visual page reviews. See the linked registry.
- Implemented Places, hourly day detail, offline snapshots/app shell, comparison, explicit import preview, and shared navigation.
- Added owner bearer authorization, removed event logging, tightened stage traffic to 1 request/second with burst 3, and set seven-day Lambda log retention. Backend deployed successfully.
- Added US$3 monthly account-wide safety budget using existing billing email destinations: actual 50/80/100%, forecast 100%. Project cost tags were inactive; no misleading tag-filtered coverage claim.
- Amplify manual static release 3 succeeded. Verified HTTPS headers on root, both HTML pages, service worker, and fonts. Live browser verified provider suggestions, forecast, favorites, daily detail, and comparison navigation.
- Validation complete: 61 Python tests, 17 JavaScript tests; deterministic browser flows for place bounds, cached comparisons, import preview/save/token isolation, offline reload, compact layout, clearing data, and existing typeahead regressions. Live API denied anonymous/wrong credentials, allowed owner reads, passed preflight and the full authenticated CRUDL smoke test.
- Public artifact: 33 assets, approximately 515 KB compressed; no secrets or backend source. Release source is tracked on main; the deployment and validation records above describe the shipped runtime.
