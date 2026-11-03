"use strict";
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const storage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
const policy = RequestPolicy.create({ storage, locks: navigator.locks });
const stored = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
const media = matchMedia("(prefers-color-scheme: dark)");
let theme =
  new URLSearchParams(location.search).get("theme") ||
  stored("wb-theme", "system");
let units = stored("wb-units", "metric") === "imperial" ? "imperial" : "metric";
let weather = null,
  selectedPlace = null,
  receipt = null,
  searchVersion = 0,
  forecastVersion = 0;
const dark = () => theme === "dark" || (theme === "system" && media.matches);
function applyTheme() {
  const key = weather
    ? OpenMeteo.conditions(weather.current.weather_code)[1]
    : "board";
  document.documentElement.dataset.mode = dark() ? "dark" : "light";
  for (const [role, color] of Object.entries(
    window.PALETTES?.[key]?.[dark() ? "dark" : "light"] || {},
  ))
    document.documentElement.style.setProperty("--md-sys-color-" + role, color);
  $("themeBtn").firstElementChild.textContent = dark()
    ? "light_mode"
    : "dark_mode";
  document.querySelector("meta[name=theme-color]").content = getComputedStyle(
    document.documentElement,
  )
    .getPropertyValue("--md-sys-color-surface")
    .trim();
}
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const number = (value) =>
  finite(value) ? Math.round(value).toString() : "Unavailable";
const temp = (value) =>
  finite(value)
    ? Math.round(units === "imperial" ? (value * 9) / 5 + 32 : value) + "°"
    : "—";
const wind = (value) =>
  finite(value)
    ? Math.round(units === "imperial" ? value / 1.609344 : value) +
      (units === "imperial" ? " mph" : " km/h")
    : "Unavailable";
const local = (timestamp, options) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: weather.timezone,
    ...options,
  }).format(new Date(timestamp * 1000));
function status(message, error = false) {
  $("weatherStatus").textContent = message;
  $("weatherStatus").classList.toggle("error", error);
}
function updateUsage() {
  try {
    const usage = policy.usage("weather");
    $("usedToday").textContent = usage.day;
    $("budgetMeter").value = usage.day;
    $("usageSummary").textContent =
      `${usage.day} of 100 today · ${usage.minute} of 10 this minute · resets at 00:00 UTC`;
  } catch {
    $("usageSummary").textContent =
      "Request counter unavailable. Requests are blocked until browser storage works.";
  }
}
function decorate() {
  document
    .querySelectorAll(".sym")
    .forEach((el) => el.setAttribute("aria-hidden", "true"));
}
function render() {
  applyTheme();
  document
    .querySelectorAll("[data-unit]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", button.dataset.unit === units),
    );
  if (!weather) {
    decorate();
    return;
  }
  const current = weather.current,
    [condition, key, icon] = OpenMeteo.conditions(current.weather_code);
  const region = [selectedPlace.admin1, selectedPlace.country]
    .filter(Boolean)
    .join(", ");
  $("welcome").hidden = true;
  $("weatherContent").hidden = false;
  $("currentWeather").innerHTML =
    `<div class="current-top"><div><p class="eyebrow">Right here, right now</p><h2 id="placeName" tabindex="-1">${esc(selectedPlace.name)}</h2><p class="place-meta">${esc(region || `${selectedPlace.latitude.toFixed(3)}, ${selectedPlace.longitude.toFixed(3)}`)} · ${esc(local(current.time, { weekday: "short", hour: "numeric", minute: "2-digit" }))}</p></div><button id="refreshWeather" type="button" class="icon-btn" aria-label="Refresh this forecast (uses cache for 15 minutes)"><span class="sym">refresh</span></button></div>
    <div class="current-body"><div><div class="temperature" aria-label="${esc(temp(current.temperature_2m))} ${units === "imperial" ? "Fahrenheit" : "Celsius"}">${temp(current.temperature_2m)}</div><p class="condition-label">${esc(condition)}</p><span class="feels">Feels like ${temp(current.apparent_temperature)} · ${units === "imperial" ? "°F" : "°C"}</span></div><div class="weather-art" data-kind="${key}" aria-hidden="true"><span class="sym">${icon}</span></div></div>
    <div class="current-measures"><div><span class="sym">humidity_percentage</span><span><b>${finite(current.relative_humidity_2m) ? number(current.relative_humidity_2m) + "%" : "Unavailable"}</b><small>Humidity</small></span></div><div><span class="sym">air</span><span><b>${wind(current.wind_speed_10m)}</b><small>Wind speed</small></span></div><div><span class="sym">device_thermostat</span><span><b>${temp(weather.daily.temperature_2m_min?.[0])} / ${temp(weather.daily.temperature_2m_max?.[0])}</b><small>Today’s low / high</small></span></div></div><p class="observation-line">${receipt.cached ? "Cached forecast" : "Forecast fetched"} at ${esc(new Date(receipt.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))} · ${esc(weather.timezone)} · Model time ${esc(local(current.time, { hour: "2-digit", minute: "2-digit" }))}</p>`;
  $("refreshWeather").onclick = () => loadForecast(selectedPlace);
  const indices = weather.hourly.time
    .map((time, index) => ({ time, index }))
    .filter((it) => it.time >= Math.floor(current.time / 3600) * 3600)
    .slice(0, 24);
  $("hourlyList").innerHTML = indices
    .map(
      ({ time, index }) =>
        `<div class="hour-cell"><span>${esc(local(time, { hour: "numeric" }))}</span><b>${temp(weather.hourly.temperature_2m?.[index])}</b><small>${finite(weather.hourly.precipitation_probability?.[index]) ? number(weather.hourly.precipitation_probability[index]) + "% rain" : "Rain n/a"}</small></div>`,
    )
    .join("");
  const points = indices.map(({ time, index }) => ({
    time,
    value: weather.hourly.temperature_2m?.[index],
  }));
  const valid = points.filter((it) => finite(it.value));
  if (valid.length) {
    const min = Math.min(...valid.map((it) => it.value)),
      max = Math.max(...valid.map((it) => it.value)),
      span = Math.max(max - min, 2);
    const segments = [];
    let segment = [];
    points.forEach((it, i) => {
      if (!finite(it.value)) {
        if (segment.length) segments.push(segment);
        segment = [];
      } else
        segment.push(
          `${24 + (i / Math.max(points.length - 1, 1)) * 432},${112 - ((it.value - min) / span) * 76}`,
        );
    });
    if (segment.length) segments.push(segment);
    $("hourlyChart").innerHTML =
      `<svg viewBox="0 0 480 160" role="img" aria-label="Hourly temperature forecast. Values are available in the scrollable hourly list."><line x1="24" y1="126" x2="456" y2="126" stroke="currentColor" opacity=".15"/>${segments.map((segment) => `<polyline points="${segment.join(" ")}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}<text class="chart-label" x="24" y="22">${temp(max)} high</text><text class="chart-label" x="456" y="22" text-anchor="end">${temp(min)} low</text><text class="chart-label" x="24" y="150">${esc(local(points[0].time, { hour: "numeric" }))}</text><text class="chart-label" x="456" y="150" text-anchor="end">${esc(local(points.at(-1).time, { hour: "numeric" }))}</text></svg>`;
  } else
    $("hourlyChart").innerHTML =
      "<p>Hourly temperatures are unavailable for this location.</p>";
  const lows = weather.daily.temperature_2m_min || [],
    highs = weather.daily.temperature_2m_max || [];
  const extremes = [...lows, ...highs].filter(finite),
    low = Math.min(...extremes),
    high = Math.max(...extremes),
    range = Math.max(high - low, 1);
  $("dailyList").innerHTML = weather.daily.time
    .slice(0, 7)
    .map((time, i) => {
      const [label, , symbol] = OpenMeteo.conditions(
        weather.daily.weather_code?.[i],
      );
      const hasRange = finite(lows[i]) && finite(highs[i]);
      return `<div class="day-row"><b>${i === 0 ? "Today" : esc(local(time, { weekday: "short" }))}</b><span class="sym" role="img" aria-label="${esc(label)}">${symbol}</span><span class="range"><span>${temp(lows[i])}</span><span class="range-track" aria-hidden="true">${hasRange ? `<i style="left:${((lows[i] - low) / range) * 100}%;width:${Math.max(((highs[i] - lows[i]) / range) * 100, 3)}%"></i>` : ""}</span></span><b>${temp(highs[i])}</b></div>`;
    })
    .join("");
  decorate();
  // Conditions must remain available when icons are hidden from assistive technology.
  document
    .querySelectorAll(".day-row .sym")
    .forEach((el) => el.removeAttribute("aria-hidden"));
}
async function loadForecast(place) {
  const version = ++forecastVersion;
  ++searchVersion;
  $("searchResults").hidden = true;
  status("Getting the forecast for " + place.name + "…");
  $("weatherContent").setAttribute("aria-busy", "true");
  try {
    const result = await policy.request(OpenMeteo.forecastURL(place), {
      ttl: 15 * 60000,
    });
    const data = OpenMeteo.validate(result.data);
    if (version !== forecastVersion) return;
    weather = data;
    selectedPlace = {
      ...place,
      ...OpenMeteo.coordinates(place.latitude, place.longitude),
    };
    receipt = result;
    render();
    status("");
    $("placeName").focus({ preventScroll: true });
  } catch (error) {
    if (version === forecastVersion)
      status(
        `${error.name === "AbortError" ? "The provider took too long. Try again." : error.message}${weather ? " Still showing " + selectedPlace.name + "." : ""}`,
        true,
      );
  } finally {
    if (version === forecastVersion)
      $("weatherContent").setAttribute("aria-busy", "false");
    updateUsage();
  }
}
$("worldForm").onsubmit = async (event) => {
  event.preventDefault();
  const query = $("placeInput").value.trim();
  if (query.length < 2) return;
  const version = ++searchVersion;
  $("searchResults").hidden = false;
  $("searchStatus").textContent = "Finding places…";
  $("placeResults").replaceChildren();
  try {
    const result = await policy.request(
      "https://geocoding-api.open-meteo.com/v1/search?" +
        new URLSearchParams({
          name: query,
          count: 8,
          language: "en",
          format: "json",
        }),
      { ttl: 86400000 },
    );
    if (version !== searchVersion) return;
    const results = (
      Array.isArray(result.data.results) ? result.data.results : []
    ).filter(
      (it) =>
        finite(it.latitude) &&
        finite(it.longitude) &&
        typeof it.name === "string",
    );
    $("searchStatus").textContent = results.length
      ? `${results.length} matches. Choose a place for its forecast.`
      : "No matches. Try another spelling, a postal code, or coordinates.";
    results.forEach((place) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "place-row";
      button.innerHTML = `<span class="sym" aria-hidden="true">location_on</span><span><strong>${esc(place.name)}</strong><small>${esc([place.admin1, place.country].filter(Boolean).join(", "))} · ${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}</small></span><span class="sym" aria-hidden="true">arrow_forward</span>`;
      button.onclick = () => loadForecast(place);
      $("placeResults").append(button);
    });
  } catch (error) {
    if (version === searchVersion)
      $("searchStatus").textContent =
        error.name === "AbortError"
          ? "Location search timed out. Try again."
          : error.message;
  } finally {
    updateUsage();
  }
};
$("placeInput").oninput = () => {
  ++searchVersion;
  $("searchResults").hidden = true;
};
$("closeResults").onclick = () => {
  ++searchVersion;
  $("searchResults").hidden = true;
  $("placeInput").focus();
};
$("placeInput").onkeydown = (event) => {
  if (event.key === "Escape") $("closeResults").click();
};
$("coordinateForm").onsubmit = (event) => {
  event.preventDefault();
  try {
    const point = OpenMeteo.coordinates(
      $("latitude").value,
      $("longitude").value,
    );
    loadForecast({
      ...point,
      name: `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`,
    });
  } catch (error) {
    status(error.message, true);
  }
};
const starters = {
  douala: {
    name: "Douala",
    country: "Cameroon",
    admin1: "Littoral",
    latitude: 4.0483,
    longitude: 9.7043,
  },
  tokyo: {
    name: "Tokyo",
    country: "Japan",
    latitude: 35.6762,
    longitude: 139.6503,
  },
  oslo: {
    name: "Oslo",
    country: "Norway",
    latitude: 59.9139,
    longitude: 10.7522,
  },
};
document
  .querySelectorAll("[data-city]")
  .forEach(
    (button) =>
      (button.onclick = () => loadForecast(starters[button.dataset.city])),
  );
document.querySelectorAll("[data-unit]").forEach(
  (button) =>
    (button.onclick = () => {
      units = button.dataset.unit;
      save("wb-units", units);
      render();
    }),
);
$("themeBtn").onclick = () => {
  theme = dark() ? "light" : "dark";
  save("wb-theme", theme);
  applyTheme();
};
media.addEventListener("change", applyTheme);
$("usageShortcut").onclick = () => {
  $("usageDetails").open = true;
  $("usage").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
      ? "instant"
      : "smooth",
  });
};
window.addEventListener("storage", updateUsage);
window.addEventListener("focus", updateUsage);
render();
updateUsage();
