# Weather Board: design research and decisions

The dashboard in `web/index.html` was redesigned on 27 October 2026 in the language of **Material 3 Expressive** (M3E), Google's May 2025 evolution of Material 3. This document records what was studied and why each design choice was made.

---

## 1. Research

| Source | Sample | How it was studied |
| --- | --- | --- |
| Material 3 Expressive guidance (m3.material.io) | Launch article, shape principles, corner tokens, type and motion updates | Read in full |
| Dribbble | **147 designs**: 42 "weather app", 42 "weather dashboard", 42 "weather widget", plus 21 Material You / M3 Expressive pieces | Rendered as contact sheets and reviewed shot by shot |
| Google Play | **97 Android weather apps** catalogued from 8 searches. **60** store screenshots reviewed, plus all **8** Google Weather screens in detail | Same contact-sheet method |
| Weather websites | **14** attempted (BBC, MSN, Ventusky, Windy, yr, meteoblue, Met Office, AccuWeather, weather.com, timeanddate, Weather Underground, Zoom Earth, Google, Open-Meteo). **6** were readable in a headless browser; the rest were blocked, behind consent walls, or returned errors | Full-page screenshots |

In total: **111 platforms catalogued, about 74 studied visually, and 147 designs reviewed.**

### What the study showed

**What separates professional products from concept shots**
- The real platforms (Google Weather, yr, BBC, Windy, Ventusky) are restrained. They lead with the current state, then dense, scannable strips and tables. Decoration never competes with data.
- Concept shots on Dribbble lean on photography, glassmorphism and glossy 3D weather icons. These are the most recognisable "template" look.
- The **"Today's Highlights" bento grid** (UV gauge, wind, sunrise, humidity, visibility, AQI) appears in dozens of dashboard shots with almost identical layouts. It is the clearest signal of a generic design, so it was avoided.

**What the most memorable designs share**
- **One oversized number or phrase as the hero.** Giant thin numerals in Google Weather, editorial sentences like "It's raining now" in the best concept shots.
- **Colour that means something.** Warm fields for sun and heat, deep blue for rain, violet for storms, desaturated grey for fog.
- **Abstract geometric weather art** instead of photos: cropped suns, dotted snow, diagonal rain. It ages well and works in light and dark.

**Google Weather is the reference implementation of M3E for weather.** Its detail tiles each use a different shape that hints at meaning: a scalloped cookie for visibility, a container with a water line for humidity, a circular gauge for pressure, a pill holding three ring gauges for pollen. Its Wear OS tiles mix pill and cut-corner shapes in bold tonal colours. Material Design states the principle directly: shape morph should communicate *changes in the environment, like temperature or time of day*.

---

## 2. Design decisions

Each decision maps to one of M3 Expressive's seven tactics.

| M3E tactic | How Weather Board applies it |
| --- | --- |
| **Use a variety of shapes** | Every condition has its own shape from the M3 shape family: Sunny = 8-point soft burst, HOT = 12-point "very sunny", Rainy = 12-sided cookie (a ripple), Drizzle = soft burst, Cloudy = puffy, Stormy = spiky burst, Cold = flower, Windy = 4-leaf clover, Foggy = pill. The four "at a glance" tiles each use a different container shape (rounded square, full pill, cut-corner square, arch), echoing Google Weather. |
| **Apply rich and nuanced colours** | Every condition has a full M3 colour scheme (light and dark), generated with Google's `material-color-utilities` using the **Fidelity** scheme so each condition keeps its true hue (fog stays grey, sun stays butter yellow). The page, the hero and each card use the scheme of their condition. |
| **Guide attention with typography** | **Google Sans Flex**, M3E's typeface, with its `ROND` (roundness) axis at 100 for headlines and 0 for body text. The hero headline uses an emphasized display style (weight 760, up to 132 px). Ids, paths and routes use **Google Sans Code**. |
| **Contain content for emphasis** | Three clear containers: the hero (latest reading), the glance tiles, and the readings section. "Under the hood" is its own surface tier. |
| **Add fluid and natural motion** | Motion uses **M3 Expressive springs**, converted into CSS `linear()` curves at startup from their stiffness and damping values (spatial fast 800/0.6, default 380/0.8, slow 200/0.8). Shapes morph with `clip-path`; buttons and chips change corner radius when pressed. Reduced-motion settings are respected. |
| **Leverage component flexibility** | Window-class breakpoints at 1200 and 840 px. On compact screens the side sheet becomes a bottom sheet and the extended FAB becomes a regular FAB. |
| **Combine tactics into a hero moment** | One hero moment: the latest reading as a sentence ("It's rainy in Buea") next to its large condition shape, which morphs and re-themes the whole page when a new reading arrives. |

### Components used (all hand-built with M3 tokens)
App bar with a **connected button group** (Demo / Live API) and a pill **search bar**. An **extended FAB** opens a **side sheet** (bottom sheet on phones) containing a filled **text field**, **assist chips** for towns, and a **shape-morphing radio grid** for conditions. Also **filter chips**, **icon buttons**, the M3E **loading indicator** (shapes morphing inside a container), the M3E **wavy progress indicator** (under the app bar while a request is in flight), and a **snackbar**.

### What was deliberately avoided
Photographic backgrounds, glassmorphism, glossy 3D weather icons, the generic highlights bento grid, gradient text, and decoration on every surface. Abstract shapes are used only where they carry meaning (condition, state) or for the single hero moment.

---

## 3. Implementation notes

- **Shape morphing:** every shape is generated as a 120-point polygon from a polar function (circle, cookies, bursts, flower, clover, puffy, pill, arch). Because all shapes have the same number of points, CSS can animate `clip-path` between any two of them.
- **Colour:** `web/palettes.js` holds 31 colour roles × light/dark for 10 seeds (one per condition plus the app default). The generator used `@material/material-color-utilities` 0.3.0 with `SchemeFidelity`; the seeds are listed in the file header. CSS fallbacks keep the page usable if `palettes.js` fails to load.
- **No build step, no framework:** one HTML file plus `palettes.js`. Fonts and icons come from Google Fonts, with the Material Symbols set subset to the icons used.
- **Robustness:** the Demo mode's id generation falls back when `crypto.randomUUID` is unavailable (pages served over plain `http://`). Transitions stay off until the first theme has painted, so the page never fades in from fallback colours.
- **Screenshots:** add `?capture` (with `&theme=light|dark`, `&sheet=new`) to keep transitions off for still captures. Headless browsers don't advance CSS transitions and otherwise freeze mid-fade. The images in this folder were made that way.
- **Verified:** light and dark at desktop width, phone width at 375 px (no horizontal overflow), and the full create → edit → filter → look up → delete flow in Demo mode. Live mode was checked read-only against the deployed API.
