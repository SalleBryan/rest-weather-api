"use strict";
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

/* ── Conditions: icon, M3 shape, palette ───────────────────────────────── */
const CONDITIONS = [
  { key: "sunny", label: "Sunny", icon: "sunny", shape: "sunny" },
  {
    key: "hot",
    label: "HOT",
    icon: "local_fire_department",
    shape: "verySunny",
  },
  { key: "cloudy", label: "Cloudy", icon: "cloud", shape: "puffy" },
  { key: "drizzle", label: "Drizzle", icon: "rainy_light", shape: "softBurst" },
  { key: "rainy", label: "Rainy", icon: "rainy", shape: "cookie12" },
  { key: "stormy", label: "Stormy", icon: "thunderstorm", shape: "burst" },
  { key: "cold", label: "Cold", icon: "ac_unit", shape: "flower" },
  { key: "windy", label: "Windy", icon: "air", shape: "clover" },
  { key: "foggy", label: "Foggy", icon: "foggy", shape: "pill" },
];
const OTHER = {
  key: "board",
  label: "Other",
  icon: "device_thermostat",
  shape: "cookie9",
};
const conditionOf = (w) =>
  CONDITIONS.find(
    (c) =>
      c.label.toLowerCase() ===
      String(w || "")
        .trim()
        .toLowerCase(),
  ) || OTHER;
const TOWNS = [
  "Buea",
  "Douala",
  "Yaoundé",
  "Limbe",
  "Bamenda",
  "Kribi",
  "Bafoussam",
  "Garoua",
  "Kumba",
  "Dschang",
];

/* ── M3 shapes as same-length polygons, so clip-path can morph between any two ── */
const N = 120;
const SHAPES = (() => {
  const polar = (f) => {
    // f(theta) -> radius; normalised so the biggest radius touches the box
    const pts = [];
    let max = 0;
    for (let i = 0; i < N; i++) {
      const t = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      const r = f(t);
      max = Math.max(max, r);
      pts.push([t, r]);
    }
    return (
      "polygon(" +
      pts
        .map(
          ([t, r]) =>
            `${(50 + ((50 * r) / max) * Math.cos(t)).toFixed(2)}% ${(50 + ((50 * r) / max) * Math.sin(t)).toFixed(2)}%`,
        )
        .join(",") +
      ")"
    );
  };
  const superellipse =
    (n, a = 1, b = 1) =>
    (t) =>
      Math.pow(
        Math.pow(Math.abs(Math.cos(t) / a), n) +
          Math.pow(Math.abs(Math.sin(t) / b), n),
        -1 / n,
      );
  const lobes =
    (k, depth, sharp = 1) =>
    (t) =>
      1 - depth * Math.pow((1 - Math.cos(k * t)) / 2, sharp);
  return {
    circle: polar(() => 1),
    square: polar(superellipse(5)),
    cookie9: polar(lobes(9, 0.09, 1)),
    cookie12: polar(lobes(12, 0.07, 1)),
    softBurst: polar(lobes(10, 0.13, 1.4)),
    sunny: polar(lobes(8, 0.16, 1.8)),
    verySunny: polar(lobes(12, 0.2, 2.4)),
    burst: polar((t) => {
      const x = ((7 * (t + Math.PI / 2)) / (2 * Math.PI)) % 1;
      return 0.74 + 0.26 * Math.abs(1 - 2 * x);
    }),
    puffy: polar(
      (t) => 0.82 + 0.18 * Math.pow(Math.abs(Math.cos(3.5 * t)), 0.5),
    ),
    flower: polar(
      (t) => 0.62 + 0.38 * Math.pow(Math.abs(Math.cos(4 * t)), 0.9),
    ),
    clover: polar(
      (t) =>
        0.58 + 0.42 * Math.pow(Math.abs(Math.cos(2 * t + Math.PI / 4)), 0.7),
    ),
    pill: polar(superellipse(3.2, 1, 0.66)),
    arch: polar((t) => (Math.sin(t) > 0 ? superellipse(4.5)(t) : 1)),
  };
})();
const setShape = (el, name) => {
  if (el) el.style.clipPath = SHAPES[name] || SHAPES.circle;
};

/* ── Springs: M3 Expressive spring values turned into CSS linear() easings ── */
(function installSprings() {
  if (!CSS.supports("transition-timing-function", "linear(0, 1)")) return;
  const spring = (stiffness, damping) => {
    const w = Math.sqrt(stiffness),
      z = damping,
      dt = 1 / 240;
    let x = 0,
      v = 0,
      t = 0;
    const pts = [];
    while (t < 3) {
      v += (-stiffness * (x - 1) - 2 * z * w * v) * dt;
      x += v * dt;
      t += dt;
      pts.push([t, x]);
      if (t > 0.1 && Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
    }
    const step = Math.max(1, Math.floor(pts.length / 48));
    const sample = pts.filter((_, i) => i % step === 0);
    sample.push([t, 1]);
    return {
      ms: Math.round(t * 1000),
      easing:
        "linear(0, " +
        sample
          .map(([pt, px]) => `${px.toFixed(4)} ${((pt / t) * 100).toFixed(1)}%`)
          .join(", ") +
        ")",
    };
  };
  const root = document.documentElement.style;
  for (const [name, s, d] of [
    ["fast", 800, 0.6],
    ["default", 380, 0.8],
    ["slow", 200, 0.8],
  ]) {
    const { ms, easing } = spring(s, d);
    root.setProperty(`--spring-${name}`, easing);
    root.setProperty(`--spring-${name}-ms`, ms + "ms");
  }
})();

/* ── Theme: dynamic colour from the latest reading + light/dark ─────────── */
let themeKey = "board";
const media = matchMedia("(prefers-color-scheme: dark)");
const params = new URLSearchParams(location.search);
// Kept in memory as well as localStorage: storage can be blocked (sandboxed previews, data: URLs, strict privacy settings).
let modeChoice = params.get("theme") || store.get("wb-theme", "system");
const isDark = () =>
  modeChoice === "dark" || (modeChoice === "system" && media.matches);
function paletteFor(key) {
  return (window.PALETTES || {})[key]?.[isDark() ? "dark" : "light"];
}
function applyTheme(key = themeKey) {
  themeKey = key;
  const root = document.documentElement;
  root.dataset.mode = isDark() ? "dark" : "light";
  $("themeBtn").firstElementChild.textContent = isDark()
    ? "light_mode"
    : "dark_mode";
  const p = paletteFor(key);
  if (!p) return; // no palettes.js: the CSS fallbacks for data-mode take over
  for (const [role, hex] of Object.entries(p))
    root.style.setProperty("--md-sys-color-" + role, hex);
  document
    .querySelector("meta[name=theme-color]")
    ?.setAttribute("content", p.surface);
}
function cardVars(key) {
  const p = paletteFor(key);
  if (!p) return "";
  return `--c-pc:${p["primary-container"]};--c-opc:${p["on-primary-container"]};--c-p:${p.primary};--c-sch:${p["surface-container-high"]};--c-os:${p["on-surface"]};--c-osv:${p["on-surface-variant"]}`;
}
media.addEventListener("change", () => {
  applyTheme();
  render();
});
$("themeBtn").onclick = () => {
  modeChoice = isDark() ? "light" : "dark";
  store.set("wb-theme", modeChoice);
  applyTheme();
  render();
};

const MEASUREMENTS = {
  temperatureC: [-100, 70],
  humidityPct: [0, 100],
  windKph: [0, 500],
  latitude: [-90, 90],
  longitude: [-180, 180],
};
function validate(body) {
  let data;
  try {
    data = JSON.parse(body || "");
  } catch {
    return [
      null,
      body ? "Request body must be valid JSON" : "Request body is required",
    ];
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    return [null, "Request body must be a JSON object"];
  for (const f of ["weather", "town"]) {
    if (typeof data[f] !== "string" || !data[f].trim())
      return [null, `'${f}' is required and must be a non-empty string`];
    if (data[f].trim().length > 60)
      return [null, `'${f}' must be at most 60 characters`];
  }
  const result = { weather: data.weather.trim(), town: data.town.trim() };
  for (const [field, [low, high]] of Object.entries(MEASUREMENTS)) {
    if (!(field in data)) continue;
    const value = data[field];
    if (
      value !== null &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < low ||
        value > high)
    )
      return [null, `${field} must be between ${low} and ${high}`];
    result[field] = value;
  }
  if (
    "latitude" in data !== "longitude" in data ||
    (data.latitude == null) !== (data.longitude == null)
  )
    return [null, "Provide latitude and longitude together"];
  if ("observedAt" in data) {
    if (
      data.observedAt !== null &&
      (typeof data.observedAt !== "string" ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(data.observedAt) ||
        !Number.isFinite(Date.parse(data.observedAt)))
    )
      return [null, "Observation time needs a valid date and timezone"];
    result.observedAt =
      data.observedAt === null ? null : new Date(data.observedAt).toISOString();
  }
  if ("source" in data) {
    if (!["manual", "imported"].includes(data.source))
      return [null, "Source must be manual or imported"];
    if (
      data.source === "imported" &&
      (typeof data.provider !== "string" ||
        !data.provider.trim() ||
        data.provider.trim().length > 60)
    )
      return [null, "Imported readings need a provider"];
    result.source = data.source;
    result.provider = data.source === "imported" ? data.provider.trim() : null;
  } else if ("provider" in data) return [null, "Provide source with provider"];
  return [result, null];
}
/* ── Talking to the API ────────────────────────────────────────────────── */
const ROUTES = {
  "POST /create-weather": ["CreateWeatherLambda", "Write · put_item"],
  "GET /weathers": ["GetAllWeatherLambda", "Read · indexed query"],
  "GET /locations": ["GetAllWeatherLambda", "Read · location prefix query"],
  "GET /weather/{id}": ["GetWeatherLambda", "Read · get_item"],
  "PUT /weather/{id}": ["UpdateWeatherLambda", "Write · update_item"],
  "DELETE /weather/{id}": ["DeleteWeatherLambda", "Write · delete_item"],
};
const mode = "live";
let ownerToken = "";
let importDraft = null,
  importSending = false;
let connectedBase = "",
  connectionVersion = 0,
  apiController = new AbortController(),
  activeView = "connection";
const requestPolicy = RequestPolicy.create({
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  },
  locks: navigator.locks,
});
let inflight = 0;
async function api(method, path, payload) {
  const connection = connectionVersion;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const route = `${method} ${path.split("?")[0].replace(/^\/weather\/[^/]+$/, "/weather/{id}")}`;
  const started = performance.now();
  let status, data;
  inflight++;
  $("wavy").classList.add("on");
  lightSteps(route);
  try {
    if (!connectedBase) throw Error("Connect your API first in Connection.");
    const result = await requestPolicy.request(connectedBase + path, {
      group: "byo",
      headers: ownerToken ? { Authorization: "Bearer " + ownerToken } : {},
      method,
      body,
      signal: apiController.signal,
    });
    status = result.status;
    data = result.data;
    const validReading = (item) =>
      item &&
      ["id", "town", "weather"].every((key) => typeof item[key] === "string");
    const pathname = path.split("?")[0];
    if (
      method === "GET" &&
      ["/weathers", "/locations"].includes(pathname) &&
      (!Array.isArray(data.items) ||
        !(data.nextCursor === null || typeof data.nextCursor === "string") ||
        !data.items.every((item) =>
          pathname === "/locations"
            ? item && typeof item.town === "string"
            : validReading(item),
        ))
    )
      throw Error(
        "Incompatible API response. Connect a Weather Board API with paginated items and nextCursor.",
      );
    if (
      (method === "POST" && !validReading(data.item)) ||
      (method === "PUT" && !validReading(data)) ||
      (method === "GET" &&
        pathname.startsWith("/weather/") &&
        !validReading(data))
    )
      throw Error(
        "Incompatible API response. A reading needs id, town, and weather.",
      );
    $("dot").className = "status-dot " + (status < 500 ? "ok" : "err");
  } catch (e) {
    $("dot").className = "status-dot err";
    status = e.status || 0;
    data = {
      message: /fetch/i.test(e.message)
        ? "Network or CORS error. Is the URL right and the API deployed?"
        : e.message,
    };
  } finally {
    if (--inflight === 0) $("wavy").classList.remove("on");
    updateByoUsage();
  }
  if (connection !== connectionVersion)
    return [0, { message: "Connection changed" }];
  logCall(
    method,
    path,
    status,
    Math.round(performance.now() - started),
    route,
    data,
  );
  return [status, data];
}

/* ── Under the hood ────────────────────────────────────────────────────── */
const STEP_SHAPES = [
  ["square", "sunny"],
  ["arch", "cookie9"],
  ["cookie12", "burst"],
  ["pill", "flower"],
];
let stepTimers = [];
function lightSteps(route) {
  const [fn, access] = ROUTES[route] || ["Unknown route", "—"];
  $("s0").textContent =
    "connected · " +
    ($("apiUrl")
      .value.replace(/^https?:\/\//, "")
      .split("/")[0] || "");
  $("s1").textContent = route;
  $("s2").textContent = fn;
  $("s3").textContent = "WeatherTable · " + access;
  stepTimers.forEach(clearTimeout);
  stepTimers = [];
  const steps = [...document.querySelectorAll(".step")];
  steps.forEach((s, i) => {
    s.classList.remove("lit");
    setShape(s.querySelector(".glyph"), STEP_SHAPES[i][0]);
  });
  steps.forEach((s, i) =>
    stepTimers.push(
      setTimeout(() => {
        s.classList.add("lit");
        setShape(s.querySelector(".glyph"), STEP_SHAPES[i][1]);
      }, i * 150),
    ),
  );
  stepTimers.push(
    setTimeout(
      () =>
        steps.forEach((s, i) => {
          s.classList.remove("lit");
          setShape(s.querySelector(".glyph"), STEP_SHAPES[i][0]);
        }),
      2600,
    ),
  );
}
function logCall(method, path, status, ms, route, data) {
  const cls =
    status === 0 ? "s0" : status >= 500 ? "s5" : status >= 400 ? "s4" : "s2";
  $("lastCall").innerHTML =
    `<span class="method m-${method}">${method}</span><span class="mono" style="font-size:13px"></span><span class="st ${cls} mono">${status || "ERR"}</span><span class="ms">${ms} ms</span>`;
  $("lastCall").children[1].textContent = route.split(" ")[1];
  const row = document.createElement("div");
  row.className = "logrow";
  row.innerHTML = `<span class="method m-${method}">${method}</span><span class="path"></span><span class="st ${cls}">${status || "ERR"}</span><span class="muted">${ms}ms</span>`;
  row.querySelector(".path").textContent = path;
  row.title = path;
  $("log").prepend(row);
  while ($("log").children.length > 30) $("log").lastChild.remove();
  $("resp").hidden = false;
  $("respBody").textContent = JSON.stringify(data, null, 2);
}

/* ── Rendering ─────────────────────────────────────────────────────────── */
let items = [],
  filter = "all",
  loading = true,
  editingId = null,
  flashId = null;
const locationOptions = new Map();
let feedLookup = false;
let feedTown = "",
  feedCursor = null,
  feedVersion = 0,
  feedBusy = false,
  historyRows = [],
  historyCursor = null,
  historyVersion = 0,
  historyBusy = false,
  townCursor = null,
  locationVersion = 0,
  pickedLocation = null;
let historyTown = "",
  historyUnits =
    store.get("wb-units", "metric") === "imperial" ? "imperial" : "metric";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const parseTime = (s) => new Date(String(s || "").replace(/\+00:00$/, "Z"));
function ago(s) {
  const d = (Date.now() - parseTime(s)) / 1000;
  if (!isFinite(d)) return "—";
  if (d < 45) return "just now";
  if (d < 3600) return Math.round(d / 60) + " min ago";
  if (d < 86400) return Math.round(d / 3600) + " h ago";
  return Math.round(d / 86400) + " d ago";
}
const fmt = (s) => {
  const t = parseTime(s);
  return isFinite(t)
    ? t.toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
};
const sentence = (c) =>
  c.key === "board"
    ? 'It’s <span class="cond"></span>'
    : {
        cold: "It’s cold",
        hot: "It’s HOT",
        windy: "It’s windy",
        foggy: "It’s foggy",
        stormy: "It’s stormy",
        drizzle: "It’s drizzling",
      }[c.key] || "It’s " + c.label.toLowerCase();

function measurementHTML(it) {
  return Object.keys(WeatherHistory.metrics)
    .filter((key) => WeatherHistory.value(it, key, historyUnits) !== null)
    .map(
      (key) =>
        `<span>${displayValue(it, key)} ${WeatherHistory.metrics[key][historyUnits]}${key === "humidityPct" ? " humidity" : key === "windKph" ? " wind" : ""}</span>`,
    )
    .join("");
}
function observationText(it) {
  const source =
    it.source === "imported"
      ? `Imported · ${it.provider || "Unspecified provider"}`
      : "Manual observation";
  const time = it.observedAt
    ? `Observed ${fmt(it.observedAt)}`
    : "Observation time not supplied";
  const location =
    it.latitude != null && it.longitude != null
      ? ` · ${it.latitude}, ${it.longitude}`
      : "";
  return `${source} · ${time}${location}`;
}
function renderHero() {
  const it = items[0];
  $("hero").className = "journal-snapshot";
  $("hero").innerHTML = it
    ? `<div><p class="eyebrow">Latest in this view</p><h2>${esc(it.town)}</h2><p>${esc(it.weather)} · ${esc(fmt(it.observedAt || it.createdAt))}</p></div><strong>${typeof it.temperatureC === "number" ? displayValue(it, "temperatureC") + (historyUnits === "imperial" ? " °F" : " °C") : "—"}</strong>`
    : `<div><p class="eyebrow">A fresh page</p><h2>${loading ? "Loading your readings…" : "Every observation starts a story."}</h2><p>${loading ? "Asking your connected API." : "Add a reading to start your weather journal."}</p></div>`;
}
function renderGlance() {
  $("glance").innerHTML =
    `<p>${items.length} readings loaded · ${new Set(items.map((it) => WeatherHistory.townKey(it.town))).size} locations in this view</p>`;
}

function renderFilters() {
  const counts = {};
  items.forEach((i) => {
    const k = conditionOf(i.weather).key;
    counts[k] = (counts[k] || 0) + 1;
  });
  const present = [...CONDITIONS, OTHER].filter((c) => counts[c.key]);
  if (filter !== "all" && !counts[filter]) filter = "all";
  $("filters").innerHTML = [
    `<button class="fchip" data-k="all" aria-pressed="${filter === "all"}">${filter === "all" ? '<span class="sym">check</span>' : ""}All <span class="n">${items.length}</span></button>`,
  ]
    .concat(
      present.map(
        (c) =>
          `<button class="fchip" data-k="${c.key}" aria-pressed="${filter === c.key}"><span class="sym ${filter === c.key ? "fill" : ""}">${filter === c.key ? "check" : c.icon}</span>${esc(c.label)} <span class="n">${counts[c.key]}</span></button>`,
      ),
    )
    .join("");
  $("filters")
    .querySelectorAll(".fchip")
    .forEach(
      (b) =>
        (b.onclick = () => {
          filter = b.dataset.k;
          renderFilters();
          renderCards();
        }),
    );
}

function renderCards() {
  const box = $("cards");
  const shown = items.filter(
    (i) => filter === "all" || conditionOf(i.weather).key === filter,
  );
  $("count").textContent =
    shown.length === items.length
      ? items.length
      : `${shown.length} of ${items.length}`;
  if (loading && !items.length) {
    box.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="loader"><i class="shape"></i></div><div>Loading readings…</div></div>`;
    startLoader(box.querySelector(".loader i"));
    return;
  }
  if (!shown.length) {
    box.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="glyph shape"><span class="sym fill">cloud</span></div><div class="title-l" style="color:var(--md-sys-color-on-surface)">No matching loaded readings</div><div class="body-m">Load more readings, change the filters, or add a reading for this location.</div></div>`;
    setShape(box.querySelector(".glyph"), "puffy");
    return;
  }
  box.innerHTML = "";
  shown.forEach((it) => {
    const c = conditionOf(it.weather);
    const el = document.createElement("article");
    el.className =
      "card" +
      (it.id === editingId ? " editing" : "") +
      (it.id === flashId ? " flash" : "");
    el.setAttribute("style", cardVars(c.key));
    el.innerHTML = `<div class="glyph shape"><span class="sym">${c.icon}</span></div>
      <div><button type="button" class="town town-history-link"></button><div class="cond"></div><div class="when"></div></div>
      <div class="readout">${measurementHTML(it)}</div><div class="provenance"></div>
      <div class="foot">
        <button class="id" type="button" title="Copy id"><span class="sym">content_copy</span><span></span></button>
        <button class="icon-btn sm" type="button" data-a="edit" aria-label="Edit"><span class="sym">edit</span></button>
        <button class="icon-btn sm" type="button" data-a="del" aria-label="Delete"><span class="sym">delete</span></button></div>`;
    el.querySelector(".provenance").textContent = observationText(it);
    el.querySelector(".town").textContent = it.town;
    el.querySelector(".town").setAttribute(
      "aria-label",
      "View history for " + it.town,
    );
    el.querySelector(".town").onclick = () => openHistory(it.town);
    el.querySelector(".cond").textContent = it.weather;
    el.querySelector(".when").textContent =
      (it.updatedAt && it.updatedAt !== it.createdAt
        ? "Updated "
        : "Created ") + ago(it.updatedAt || it.createdAt);
    el.querySelector(".when").title =
      "Created " + fmt(it.createdAt) + "\nUpdated " + fmt(it.updatedAt);
    el.querySelector(".id span:last-child").textContent = it.id.slice(0, 8);
    el.querySelector(".id").onclick = () => copyId(it.id);
    el.querySelector("[data-a=edit]").onclick = () => openSheet(it);
    el.querySelector("[data-a=del]").onclick = () => remove(it);
    setShape(el.querySelector(".glyph"), c.shape);
    box.append(el);
  });
  flashId = null;
}

function render() {
  const latest = items[0];
  applyTheme(latest ? conditionOf(latest.weather).key : "board");
  setShape(
    $("brandShape"),
    latest ? conditionOf(latest.weather).shape : "sunny",
  );
  $("brandShape").firstElementChild.textContent = latest
    ? conditionOf(latest.weather).icon
    : "sunny";
  items.forEach((it) =>
    locationOptions.set(WeatherHistory.townKey(it.town), it.town.trim()),
  );
  renderHero();
  renderGlance();
  renderFilters();
  renderCards();
  renderHistory();
  $("feedScope").textContent = feedLookup
    ? "Reading ID lookup"
    : feedTown
      ? "Saved readings for " + feedTown
      : "All saved locations";
  $("allLocations").hidden = !feedTown && !feedLookup;
  $("feedStatus").textContent = feedLookup
    ? "ID lookup result. Use All locations or Refresh to browse pages."
    : `${items.length} readings loaded${feedCursor ? " · more available" : " · end of results"}. Condition filters apply to loaded readings.`;
  $("moreReadings").hidden = !feedCursor;
  $("moreReadings").disabled = feedBusy;
}

/* History pages are independent from the main feed and queried by town/date. */
function displayValue(item, metric) {
  const v = WeatherHistory.value(item, metric, historyUnits);
  return v === null
    ? "Not supplied"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(v);
}
function tableValue(item, metric) {
  const v = WeatherHistory.value(item, metric, historyUnits);
  return v === null
    ? "Not supplied"
    : String(
        historyUnits === "metric" || metric === "humidityPct"
          ? v
          : Number(v.toPrecision(12)),
      );
}
function openHistory(town) {
  showView("history", false);
  historyTown = WeatherHistory.townKey(town);
  locationOptions.set(historyTown, town);
  loadHistory();
  renderHistory();
  $("historyTitle").focus({ preventScroll: true });
  $("townHistory").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}
function renderHistory() {
  const towns = locationOptions;
  if (!towns.has(historyTown))
    historyTown = items.length
      ? WeatherHistory.townKey(items[0].town)
      : towns.keys().next().value || "";
  $("historyTown").innerHTML = towns.size
    ? [...towns.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(
          ([key, name]) => `<option value="${esc(key)}">${esc(name)}</option>`,
        )
        .join("")
    : '<option value="">No towns yet</option>';
  document
    .querySelectorAll("[data-metric]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        button.dataset.metric === $("historyMetric").value,
      ),
    );
  $("historyTown").value = historyTown;
  $("historyUnits").value = historyUnits;
  const from = $("historyFrom").value,
    to = $("historyTo").value;
  const invalid =
    $("historyFrom").validity.badInput ||
    $("historyTo").validity.badInput ||
    (from && to && from > to);
  $("historyError").textContent = invalid
    ? "Choose valid dates, with From on or before Through."
    : "";
  const rows = invalid
    ? []
    : WeatherHistory.select(historyRows, historyTown, from, to);
  const metric = $("historyMetric").value,
    info = WeatherHistory.metrics[metric],
    unit = info[historyUnits];
  const model = WeatherHistory.chart(rows, metric, historyUnits);
  const town = towns.get(historyTown) || "this town";
  $("historyStatus").textContent = historyBusy
    ? "Loading saved readings…"
    : `${rows.length} loaded reading${rows.length === 1 ? "" : "s"} for ${town}${from || to ? " in this date range" : ""}${historyCursor ? " · load older readings to extend the chart" : " · end of results"}.`;
  $("moreHistory").hidden = !historyCursor;
  $("moreHistory").disabled = historyBusy;
  $("moreTownOptions").hidden = !townCursor;
  if (!model.count) {
    $("historyChart").innerHTML =
      `<p class="history-summary">${invalid ? "Check the date range above." : !rows.length ? "No saved readings in this range." : "No dated " + info.label.toLowerCase() + " measurements yet. Add a reading with this measurement to start a chart."}</p>`;
  } else {
    const number = (v) =>
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(v);
    const width = Math.max(
      280,
      Math.min(640, $("historyChart").clientWidth - 16),
    );
    const left = 48,
      right = width - 16,
      plotX = (x) => left + ((x - 64) / 552) * (right - left);
    const ticks = Array.from({ length: 4 }, (_, i) => {
      const y = 28 + i * 52,
        v = model.high - ((model.high - model.low) * i) / 3;
      return `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".12"/><text x="${left - 8}" y="${y + 4}" text-anchor="end">${esc(number(v))}</text>`;
    }).join("");
    const lines = model.segments
      .map(
        (points) =>
          (points.length > 1
            ? `<polyline points="${points.map((p) => plotX(p.x) + "," + p.y).join(" ")}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`
            : "") +
          points
            .map(
              (p) =>
                `<circle cx="${plotX(p.x)}" cy="${p.y}" r="4" fill="currentColor"><title>${esc(fmt(new Date(p.time).toISOString()))}: ${esc(number(p.value))} ${unit}</title></circle>`,
            )
            .join(""),
      )
      .join("");
    $("historyChart").innerHTML =
      `<p class="history-summary">${info.label} · <b>${esc(number(model.min))} to ${esc(number(model.max))} ${unit}</b> · ${model.count} dated measurement${model.count === 1 ? "" : "s"}</p>
      <svg viewBox="0 0 ${width} 240" role="img" aria-labelledby="chartTitle chartDesc"><title id="chartTitle">${esc(town)} ${info.label.toLowerCase()} history (${unit})</title><desc id="chartDesc">${model.count} saved measurements. Actual time spacing; gaps represent missing values. Exact values are available in the readings table below.</desc>${ticks}${lines}
      <text x="${left}" y="218">${esc(fmt(new Date(model.start).toISOString()))}</text>${model.start !== model.end ? `<text x="${right}" y="218" text-anchor="end">${esc(fmt(new Date(model.end).toISOString()))}</text>` : ""}</svg>`;
  }
  $("historyTable").innerHTML = rows.length
    ? `<table><caption>Saved readings for ${esc(town)}</caption><thead><tr><th scope="col">Time (local)</th><th scope="col">Condition</th>${Object.values(
        WeatherHistory.metrics,
      )
        .map((m) => `<th scope="col">${m.label} (${m[historyUnits]})</th>`)
        .join("")}<th scope="col">Source</th></tr></thead><tbody>${[...rows]
        .reverse()
        .map(
          (it) =>
            `<tr><td>${esc(fmt(it.observedAt || it.createdAt))}<br><small>${it.observedAt ? "Observed" : "Recorded"}</small></td><td>${esc(it.weather)}</td>${Object.keys(
              WeatherHistory.metrics,
            )
              .map((key) => `<td>${tableValue(it, key)}</td>`)
              .join(
                "",
              )}<td>${esc(it.source === "imported" ? "Imported · " + (it.provider || "Unspecified provider") : "Manual")}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
}
$("historyTown").onchange = (e) => {
  historyTown = e.target.value;
  loadHistory();
};
$("historyMetric").onchange = renderHistory;
["historyFrom", "historyTo"].forEach(
  (id) => ($(id).onchange = () => loadHistory()),
);
$("historyUnits").onchange = (e) => {
  historyUnits = e.target.value;
  store.set("wb-units", historyUnits);
  render();
};
window.addEventListener("resize", () => requestAnimationFrame(renderHistory));
$("historyReset").onclick = () => {
  $("historyFrom").value = "";
  $("historyTo").value = "";
  loadHistory();
};

/* loading indicator: cycle through shapes like M3 Expressive's loading indicator */
const LOADER_SEQ = [
  "cookie9",
  "sunny",
  "pill",
  "burst",
  "flower",
  "cookie12",
  "clover",
];
function startLoader(el) {
  if (!el) return;
  let i = 0;
  setShape(el, LOADER_SEQ[0]);
  const tick = () => {
    if (!el.isConnected) return;
    i = (i + 1) % LOADER_SEQ.length;
    setShape(el, LOADER_SEQ[i]);
    setTimeout(tick, 420);
  };
  setTimeout(tick, 420);
}

/* ── Actions ───────────────────────────────────────────────────────────── */
function pagePath(path, params) {
  return (
    path +
    "?" +
    new URLSearchParams(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== undefined && v !== "",
      ),
    )
  );
}
function mergeRows(old, fresh) {
  return [...new Map([...old, ...fresh].map((it) => [it.id, it])).values()];
}
async function refresh(append = false) {
  if (append && (feedBusy || !feedCursor)) return;
  const version = append ? feedVersion : ++feedVersion;
  if (!append) {
    items = [];
    feedCursor = null;
    feedLookup = false;
    loading = true;
  }
  feedBusy = true;
  render();
  const [status, data] = await api(
    "GET",
    pagePath("/weathers", {
      limit: 20,
      town: feedTown,
      cursor: append ? feedCursor : null,
    }),
  );
  if (version !== feedVersion) return;
  feedBusy = false;
  loading = false;
  if (status === 200 && Array.isArray(data?.items)) {
    items = mergeRows(items, data.items);
    feedCursor = data.nextCursor;
  } else
    snack(
      `${status || "ERR"} · ${esc(data?.message || "Could not load readings")}`,
      "error",
    );
  render();
  if (!append && activeView === "history") loadHistory();
}
async function loadHistory(append = false) {
  if (append && (historyBusy || !historyCursor)) return;
  const version = append ? historyVersion : ++historyVersion;
  if (!append) {
    historyRows = [];
    historyCursor = null;
  }
  if (!historyTown) {
    historyBusy = false;
    renderHistory();
    return;
  }
  const from = $("historyFrom").value,
    to = $("historyTo").value;
  if (
    $("historyFrom").validity.badInput ||
    $("historyTo").validity.badInput ||
    (from && to && from > to)
  ) {
    historyBusy = false;
    renderHistory();
    return;
  }
  const end = to ? new Date(to + "T00:00:00") : null;
  if (end) end.setDate(end.getDate() + 1);
  historyBusy = true;
  renderHistory();
  const [status, data] = await api(
    "GET",
    pagePath("/weathers", {
      limit: 20,
      town: locationOptions.get(historyTown) || historyTown,
      from: from ? new Date(from + "T00:00:00").toISOString() : null,
      to: end?.toISOString(),
      cursor: append ? historyCursor : null,
    }),
  );
  if (version !== historyVersion) return;
  historyBusy = false;
  if (status === 200 && Array.isArray(data?.items)) {
    historyRows = mergeRows(historyRows, data.items);
    historyCursor = data.nextCursor;
  } else
    snack(
      `${status || "ERR"} · ${esc(data?.message || "Could not load history")}`,
      "error",
    );
  renderHistory();
}
async function loadTownOptions(append = false) {
  const version = locationVersion;
  const [status, data] = await api(
    "GET",
    pagePath("/locations", { limit: 20, cursor: append ? townCursor : null }),
  );
  if (version !== locationVersion) return;
  if (status === 200) {
    data.items.forEach((it) =>
      locationOptions.set(WeatherHistory.townKey(it.town), it.town),
    );
    townCursor = data.nextCursor;
    renderHistory();
  }
}
$("moreReadings").onclick = () => refresh(true);
$("moreHistory").onclick = () => loadHistory(true);
$("moreTownOptions").onclick = () => loadTownOptions(true);
$("allLocations").onclick = () => {
  feedTown = "";
  pickedLocation = null;
  refresh();
};

async function remove(it) {
  const [status, data] = await api(
    "DELETE",
    `/weather/${encodeURIComponent(it.id)}`,
  );
  if (status === 200) {
    snack(`Deleted ${esc(it.town)} · <b>200</b>`, "delete");
    if (editingId === it.id) closeSheet();
    await refresh();
    items = items.filter((row) => row.id !== it.id);
    historyRows = historyRows.filter((row) => row.id !== it.id);
    render();
  } else
    snack(
      `${status || "ERR"} · ${esc(data?.message || "Delete failed")}`,
      "error",
    );
}
async function copyId(id) {
  try {
    await navigator.clipboard.writeText(id);
    snack("Copied id <b>" + esc(id.slice(0, 8)) + "…</b>", "content_copy");
  } catch {
    $("searchKind").value = "id";
    $("searchKind").onchange();
    $("lookupId").value = id;
    snack("Id placed in the search box", "content_copy");
  }
}
let searchVersion = 0,
  searchCursor = null,
  searchQuery = "";
function chooseLocation(name, coordinates = null) {
  showView("readings");
  pickedLocation = coordinates;
  feedTown = name;
  locationOptions.set(WeatherHistory.townKey(name), name);
  historyTown = WeatherHistory.townKey(name);
  savedSuggestions.close();
  filter = "all";
  refresh();
}
function resultButton(parent, label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "place-row";
  button.textContent = label;
  button.onclick = action;
  $(parent).append(button);
}
async function searchSaved(append = false) {
  savedSuggestions.cancel();
  const version = append ? searchVersion : ++searchVersion;
  if (!append) {
    searchQuery = $("lookupId").value.trim();
    searchCursor = null;
    $("locationResults").replaceChildren();
  }
  savedSuggestions.open();
  $("locationStatus").textContent = "Searching saved locations…";
  $("moreSearchLocations").disabled = true;
  const [status, data] = await api(
    "GET",
    pagePath("/locations", {
      q: searchQuery,
      limit: 10,
      cursor: append ? searchCursor : null,
    }),
  );
  if (version !== searchVersion) return;
  if (status === 200) {
    data.items.forEach((it) =>
      resultButton("locationResults", it.town, () => chooseLocation(it.town)),
    );
    searchCursor = data.nextCursor;
    $("locationStatus").textContent = $("locationResults").children.length
      ? "Saved locations. Select one to see its readings."
      : "No saved locations match. Try a town prefix, or add a reading.";
  } else
    $("locationStatus").textContent =
      data?.message || "Saved location search is unavailable.";
  $("moreSearchLocations").hidden = !searchCursor;
  $("moreSearchLocations").disabled = false;
  savedSuggestions.update();
}
$("moreSearchLocations").onclick = () => searchSaved(true);
const savedSuggestions = Typeahead.attach({
  input: $("lookupId"),
  form: $("searchForm"),
  panel: $("searchPanel"),
  list: $("locationResults"),
  search: () => searchSaved(),
  invalidate: () => ++searchVersion,
  eligible: () =>
    !!connectedBase &&
    $("searchKind").value === "location" &&
    $("lookupId").value.trim().length <= 60,
});
$("closeSearch").onclick = () => {
  savedSuggestions.close();
  $("lookupId").focus();
};
$("searchKind").onchange = () => {
  $("lookupId").placeholder =
    $("searchKind").value === "id"
      ? "Paste a full reading ID"
      : "Search saved towns or cities";
  savedSuggestions.close();
};
$("searchForm").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("lookupId").value.trim();
  if (!text) {
    $("lookupId").focus();
    return;
  }
  if ($("searchKind").value === "location") {
    if (text.length > 60) {
      snack("Location searches must be at most 60 characters", "error");
      return;
    }
    return searchSaved();
  }
  const version = ++feedVersion;
  const [status, data] = await api(
    "GET",
    `/weather/${encodeURIComponent(text)}`,
  );
  if (version !== feedVersion) return;
  if (status === 200) {
    feedTown = "";
    feedCursor = null;
    ++feedVersion;
    feedBusy = false;
    feedLookup = true;
    items = [data];
    filter = "all";
    flashId = data.id;
    historyTown = WeatherHistory.townKey(data.town);
    render();
    loadHistory();
    document
      .querySelector(".card.flash")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  } else
    snack(`${status || "ERR"} · ${esc(data?.message || "Not found")}`, "error");
};

/* ── Sheet (create / edit) ─────────────────────────────────────────────── */
let selected = "Rainy";
function renderPicker() {
  $("picker").innerHTML = CONDITIONS.map(
    (c) =>
      `<button type="button" class="opt" role="radio" aria-checked="${c.label === selected}" data-l="${c.label}" style="${cardVars(c.key)}"><div class="glyph shape"><span class="sym">${c.icon}</span></div>${esc(c.label)}</button>`,
  ).join("");
  $("picker")
    .querySelectorAll(".opt")
    .forEach((b) => {
      setShape(
        b.querySelector(".glyph"),
        b.dataset.l === selected ? conditionOf(b.dataset.l).shape : "circle",
      );
      b.onclick = () => selectCondition(b.dataset.l);
    });
  $("pickedName").textContent = selected;
}
function selectCondition(label) {
  selected = label;
  $("pickedName").textContent = label;
  $("picker")
    .querySelectorAll(".opt")
    .forEach((b) => {
      const on = b.dataset.l === label;
      b.setAttribute("aria-checked", on);
      setShape(
        b.querySelector(".glyph"),
        on ? conditionOf(label).shape : "circle",
      );
    });
}
$("townChips").innerHTML = TOWNS.map(
  (t) => `<button type="button" class="tchip">${t}</button>`,
).join("");
$("townChips")
  .querySelectorAll(".tchip")
  .forEach(
    (b) =>
      (b.onclick = () => {
        $("town").value = b.textContent;
        $("townHelp").className = "help";
        $("townHelp").textContent = "Where was this reading taken?";
      }),
  );

function openSheet(it) {
  if (!connectedBase) {
    showView("connection");
    return;
  }
  $("sheet").inert = false;
  $("workspaceShell").inert = true;
  document.querySelector(".rail").inert = true;
  $("fab").inert = true;
  editingId = it ? it.id : null;
  $("sheetTitle").textContent = it ? "Edit reading" : "New reading";
  $("saveLabel").textContent = it ? "Save" : "Create";
  $("sheetRoute").textContent = it
    ? `PUT /weather/${it.id.slice(0, 8)}…`
    : "POST /create-weather";
  $("town").value = it ? it.town : feedTown;
  for (const key of Object.keys(MEASUREMENTS))
    $(key).value =
      it?.[key] ??
      (!it && pickedLocation?.[key] !== undefined ? pickedLocation[key] : "");
  const observed = it?.observedAt ? new Date(it.observedAt) : null;
  $("observedAt").value =
    observed && Number.isFinite(observed.getTime())
      ? new Date(observed.getTime() - observed.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 19)
      : "";
  $("measurementHelp").textContent =
    it?.source === "imported"
      ? "Saving edits marks this as a manual observation. Clear a field to remove it."
      : "Add only what you measured. Blank fields stay unknown.";
  $("measurementError").textContent = "";
  selected = it
    ? conditionOf(it.weather) === OTHER
      ? "Rainy"
      : conditionOf(it.weather).label
    : selected;
  $("townHelp").className = "help";
  $("townHelp").textContent = "Where was this reading taken?";
  renderPicker();
  renderCards();
  $("sheet").classList.add("open");
  $("scrim").classList.add("open");
  $("sheet").setAttribute("aria-hidden", "false");
  $("town").focus({ preventScroll: true });
}
function closeSheet() {
  $("sheet").inert = true;
  $("workspaceShell").inert = false;
  document.querySelector(".rail").inert = false;
  $("fab").inert = false;
  editingId = null;
  $("sheet").classList.remove("open");
  $("scrim").classList.remove("open");
  $("sheet").setAttribute("aria-hidden", "true");
  renderCards();
  $("fab").focus({ preventScroll: true });
}
$("fab").onclick = () => openSheet(null);
$("closeSheet").onclick = closeSheet;
$("cancelSheet").onclick = closeSheet;
$("scrim").onclick = closeSheet;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("sheet").classList.contains("open")) closeSheet();
});

$("readingForm").onsubmit = async (e) => {
  e.preventDefault();
  const town = $("town").value.trim();
  if (!town) {
    $("townHelp").className = "help err";
    $("townHelp").textContent = "Town is required";
    $("town").focus();
    return;
  }
  const payload = { weather: selected, town, source: "manual" };
  for (const key of Object.keys(MEASUREMENTS)) {
    const input = $(key);
    if (input.validity.badInput) {
      $("measurementError").textContent = "Enter a valid number";
      input.focus();
      return;
    }
    payload[key] = input.value === "" ? null : Number(input.value);
  }
  const date = $("observedAt");
  if (
    date.validity.badInput ||
    (date.value && !Number.isFinite(new Date(date.value).getTime()))
  ) {
    $("measurementError").textContent = "Enter a valid observation time";
    date.focus();
    return;
  }
  payload.observedAt = date.value ? new Date(date.value).toISOString() : null;
  const [, error] = validate(JSON.stringify(payload));
  if (error) {
    $("measurementError").textContent = error;
    return;
  }
  $("measurementError").textContent = "";
  const btn = $("saveBtn");
  btn.disabled = true;
  const icon = btn.firstElementChild;
  const holder = document.createElement("span");
  holder.className = "loader bare";
  holder.innerHTML = '<i class="shape"></i>';
  icon.replaceWith(holder);
  startLoader(holder.firstElementChild);
  const saveScope = connectionVersion + "|" + connectedBase,
    requestEditingId = editingId;
  const [status, data] = editingId
    ? await api("PUT", `/weather/${encodeURIComponent(editingId)}`, payload)
    : await api("POST", "/create-weather", payload);
  holder.replaceWith(icon);
  btn.disabled = false;
  if (
    saveScope !== connectionVersion + "|" + connectedBase ||
    editingId !== requestEditingId
  )
    return;
  if (status === 200 || status === 201) {
    flashId = editingId || data?.item?.id;
    snack(
      status === 201
        ? `Created ${esc(town)} · <b>201</b>`
        : `Updated ${esc(town)} · <b>200</b>`,
      "check",
    );
    const saved = status === 201 ? data.item : data;
    locationOptions.set(WeatherHistory.townKey(saved.town), saved.town);
    if (feedTown) feedTown = saved.town;
    historyTown = WeatherHistory.townKey(saved.town);
    closeSheet();
    filter = "all";
    await refresh();
    if (
      saveScope === connectionVersion + "|" + connectedBase &&
      (!feedTown ||
        WeatherHistory.townKey(feedTown) === WeatherHistory.townKey(saved.town))
    ) {
      items = mergeRows(items, [saved]).sort(
        (a, b) =>
          WeatherHistory.time(b) - WeatherHistory.time(a) ||
          b.id.localeCompare(a.id),
      );
      if (historyTown === WeatherHistory.townKey(saved.town))
        historyRows = mergeRows(historyRows, [saved]);
      render();
    }
  } else {
    $("townHelp").className = "help err";
    $("townHelp").textContent =
      `${status || "ERR"} · ${data?.message || "Something went wrong"}`;
  }
};

/* ── Snackbar ──────────────────────────────────────────────────────────── */
let snackTimer;
function snack(html, icon = "check") {
  $("snackIcon").textContent = icon === "error" ? "close" : icon;
  $("snackText").innerHTML = html;
  $("snack").classList.add("show");
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => $("snack").classList.remove("show"), 3200);
}

function updateByoUsage() {
  try {
    const usage = requestPolicy.usage("byo");
    $("byoUsage").textContent =
      `${usage.day} of 100 requests today · ${usage.minute} of 10 this minute · resets at 00:00 UTC`;
  } catch {
    $("byoUsage").textContent =
      "Request counter unavailable. Browser storage is required to connect.";
  }
}
function showView(view, load = true) {
  if (view !== "readings") savedSuggestions.close();
  activeView = connectedBase ? view : "connection";
  document
    .querySelectorAll("[data-pane]")
    .forEach((el) => (el.hidden = el.dataset.pane !== activeView));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.view === activeView);
    button.disabled = !connectedBase && button.dataset.view !== "connection";
  });
  $("fab").hidden = !connectedBase || activeView === "connection";
  if (activeView === "history" && load) loadHistory();
  renderHistory();
}
function disconnect() {
  savedSuggestions.close();
  apiController.abort();
  apiController = new AbortController();
  connectedBase = "";
  ownerToken = "";
  $("apiToken").value = "";
  $("saveImport").disabled = true;
  ++connectionVersion;
  ++feedVersion;
  ++historyVersion;
  ++locationVersion;
  ++searchVersion;
  items = [];
  historyRows = [];
  locationOptions.clear();
  feedCursor = null;
  historyCursor = null;
  townCursor = null;
  historyTown = "";
  feedTown = "";
  pickedLocation = null;
  feedLookup = false;
  feedBusy = false;
  historyBusy = false;
  loading = false;
  $("searchPanel").hidden = true;
  $("disconnectBtn").hidden = true;
  $("connectionBadge").textContent = "Disconnected";
  $("connectionStatus").textContent =
    "Disconnected. No more requests will be sent.";
  $("dot").className = "status-dot";
  if ($("sheet").classList.contains("open")) closeSheet();
  showView("connection");
  render();
}
$("connectForm").onsubmit = async (event) => {
  event.preventDefault();
  let base;
  try {
    base = RequestPolicy.apiBase($("apiUrl").value);
  } catch (error) {
    $("connectionStatus").textContent = error.message;
    return;
  }
  const token = $("apiToken").value.trim();
  if (token && !/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    $("connectionStatus").textContent =
      "Enter a valid owner token, or leave it empty for a compatible API without token authentication.";
    return;
  }
  disconnect();
  ownerToken = token;
  connectedBase = base;
  $("saveImport").disabled = !importDraft;
  store.set("wb-url", base);
  $("apiUrl").value = base;
  $("disconnectBtn").hidden = false;
  $("connectionBadge").textContent = "Connected · " + new URL(base).hostname;
  $("connectionStatus").textContent = "Connected. Loading your saved readings.";
  showView("readings");
  await Promise.all([refresh(), loadTownOptions()]);
};
$("apiUrl").value = store.get("wb-url", "");
$("apiUrl").oninput = () => {
  if (connectedBase) disconnect();
};
$("apiToken").oninput = () => {
  if (connectedBase) disconnect();
};
$("disconnectBtn").onclick = disconnect;
$("connectionShortcut").onclick = () => showView("connection");
document
  .querySelectorAll("[data-view]")
  .forEach((button) => (button.onclick = () => showView(button.dataset.view)));
document.querySelectorAll("[data-metric]").forEach(
  (button) =>
    (button.onclick = () => {
      $("historyMetric").value = button.dataset.metric;
      renderHistory();
    }),
);
$("refreshBtn").onclick = () => refresh();
window.addEventListener("storage", updateByoUsage);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || !$("sheet").classList.contains("open")) return;
  const controls = [
    ...$("sheet").querySelectorAll('button,input,select,[tabindex="0"]'),
  ].filter((el) => !el.disabled && el.getClientRects().length);
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

/* wavy progress path */
(function () {
  let d = "M0 3";
  for (let x = 0; x <= 1240; x += 10)
    d += ` Q${x + 5} ${x % 20 ? 6 : 0} ${x + 10} 3`;
  $("wavePath").setAttribute("d", d);
})();

/* ── Start ─────────────────────────────────────────────────────────────── */
STEP_SHAPES.forEach((s, i) =>
  setShape(document.querySelectorAll(".step .glyph")[i], s[0]),
);
applyTheme("board");
loading = false;
render();
showView("connection");
updateByoUsage();
// ?capture keeps transitions off, for still screenshots (headless browsers don't advance CSS transitions)
if (!params.has("capture"))
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      document.documentElement.classList.add("ready"),
    ),
  );

document
  .querySelectorAll(".sym")
  .forEach((el) => el.setAttribute("aria-hidden", "true"));

// Forecast imports stay in a short-lived, same-tab draft until the user saves.
const draftId = params.get("import");
if (draftId && /^[a-f0-9-]{36}$/.test(draftId)) {
  try {
    const draft = JSON.parse(sessionStorage.getItem("wb-import-" + draftId));
    const [payload, error] = validate(JSON.stringify(draft?.payload));
    if (
      error ||
      !payload ||
      payload.source !== "imported" ||
      payload.provider !== "Open-Meteo" ||
      !Number.isFinite(draft.fetchedAt) ||
      !Number.isFinite(draft.createdAt) ||
      Date.now() - draft.createdAt > 3600000 ||
      draft.createdAt > Date.now() + 60000
    )
      throw Error("Expired or invalid draft");
    importDraft = { ...draft, payload };
    $("importPane").hidden = false;
    $("importSummary").textContent =
      `${payload.town} · model time ${new Date(payload.observedAt).toISOString()} · forecast timezone ${draft.timezone} · fetched ${new Date(draft.fetchedAt).toISOString()}${Date.now() - draft.fetchedAt >= 900000 ? " · stale saved forecast" : ""}`;
    $("importPayload").textContent = JSON.stringify(payload, null, 2);
    $("importStatus").textContent =
      "Connect your API to enable Save. Nothing has been sent.";
  } catch {
    $("connectionStatus").textContent =
      "The forecast draft expired or could not be read. Return to Weather to create another.";
  }
  history.replaceState(null, "", location.pathname);
}
$("cancelImport").onclick = () => {
  if (importSending) return;
  importDraft = null;
  try {
    sessionStorage.removeItem("wb-import-" + draftId);
  } catch {}
  $("importPane").hidden = true;
};
$("saveImport").onclick = async () => {
  if (!connectedBase || !importDraft || importSending) return;
  importSending = true;
  $("saveImport").disabled = true;
  $("cancelImport").disabled = true;
  const scope = connectionVersion,
    draft = importDraft;
  $("importStatus").textContent = "Saving once. No automatic retry…";
  const [code, result] = await api("POST", "/create-weather", draft.payload);
  importSending = false;
  $("cancelImport").disabled = false;
  if (scope !== connectionVersion) {
    $("importStatus").textContent =
      "Connection changed during Save. Check the journal before creating another import.";
    return;
  }
  if (code === 201) {
    importDraft = null;
    try {
      sessionStorage.removeItem("wb-import-" + draftId);
    } catch {}
    $("importStatus").textContent =
      "Forecast saved with Open-Meteo attribution and the original model timestamp.";
    await refresh();
  } else {
    $("importStatus").textContent =
      (result.message || "Could not save.") +
      (code === 0
        ? " The server may have received it. Check your journal before retrying."
        : " Review the connection before retrying.");
    $("saveImport").disabled = code === 0 || !connectedBase;
  }
};
