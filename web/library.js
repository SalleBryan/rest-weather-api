"use strict";
let destination = "weather",
  comparisonBusy = false;
let comparisonVersion = 0;
const compareErrors = new Map();
const stamp = (time) =>
  new Date(time).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const ageLabel = (snapshot) =>
  `${library.stale(snapshot) ? "Stale saved forecast" : "Saved forecast"} · fetched ${stamp(snapshot.fetchedAt)}`;
function validSnapshot(snapshot) {
  if (!snapshot) return null;
  try {
    OpenMeteo.validate(snapshot.data);
    return snapshot;
  } catch {
    return null;
  }
}
function showSnapshot(snapshot) {
  if (!validSnapshot(snapshot)) {
    status(
      "This saved forecast is damaged. Refresh online to replace it.",
      true,
    );
    return;
  }
  weather = snapshot.data;
  selectedPlace = snapshot.place;
  receipt = { fetchedAt: snapshot.fetchedAt, cached: true };
  library.remember(selectedPlace);
  render();
}
function openSaved(p) {
  location.hash = "weather";
  const snapshot = validSnapshot(library.snapshot(p.id));
  if (snapshot) {
    showSnapshot(snapshot);
    status(
      "Showing the saved forecast. Choose Refresh to check for newer data.",
    );
    $("placeName").focus({ preventScroll: true });
  } else loadForecast(p);
}
function card(p, kind) {
  const s = validSnapshot(library.snapshot(p.id)),
    el = document.createElement("article");
  el.className = "library-card";
  el.innerHTML = `<h3>${esc(p.name)}</h3><p class="small muted">${esc([p.admin1, p.country].filter(Boolean).join(", ") || p.id)}</p>${s ? `<p class="snapshot-temp">${temp(s.data.current.temperature_2m)}</p><p>${esc(OpenMeteo.conditions(s.data.current.weather_code)[0])}</p><p class="freshness ${library.stale(s) ? "stale" : ""}"><span data-snapshot-time="${s.fetchedAt}">${esc(ageLabel(s))}</span><br>${esc(s.data.timezone)}</p>` : "<p>No saved forecast. Open this place to load it.</p>"}<div class="library-actions"></div>`;
  if (s && kind === "compare") {
    const measures = document.createElement("dl");
    measures.className = "compare-measures";
    const c = s.data.current;
    measures.innerHTML = `<div><dt>Humidity</dt><dd>${finite(c.relative_humidity_2m) ? number(c.relative_humidity_2m) + "%" : "Unavailable"}</dd></div><div><dt>Wind</dt><dd>${wind(c.wind_speed_10m)}</dd></div><div><dt>Daily low / high</dt><dd>${temp(s.data.daily.temperature_2m_min?.[0])} / ${temp(s.data.daily.temperature_2m_max?.[0])}</dd></div>`;
    el.querySelector(".library-actions").before(measures);
  }
  const actions = el.querySelector(".library-actions");
  function button(label, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = fn;
    actions.append(b);
    return b;
  }
  button("Open forecast", () => openSaved(p));
  if (kind !== "compare")
    button("Compare", () => {
      try {
        library.compare(p);
        location.hash = "compare";
        renderCollections();
      } catch (e) {
        status(e.message, true);
        $("storageNote").textContent = e.message;
      }
    });
  if (kind === "recents")
    button(library.favorite(p.id) ? "Unfavorite" : "Favorite", () => {
      try {
        library.toggle(p);
        renderCollections();
      } catch (e) {
        $("storageNote").textContent = e.message;
      }
    });
  button("Remove", () => {
    library.remove(kind, p.id);
    renderCollections();
  });
  const err = compareErrors.get(p.id);
  if (kind === "compare" && err) {
    const note = document.createElement("p");
    note.className = "local-note";
    note.textContent = err;
    el.append(note);
  }
  return el;
}
function renderCollections() {
  for (const [kind, id] of [
    ["favorites", "favoriteGrid"],
    ["recents", "recentGrid"],
    ["compare", "compareGrid"],
  ]) {
    const rows = library.list(kind);
    $(id).replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "empty-library";
      empty.textContent =
        kind === "favorites"
          ? "Find a forecast and choose Save favorite. Your favorite places will appear here."
          : kind === "compare"
            ? "Add up to three places from a forecast or your Places list."
            : "Your next forecast will appear here. No weather requests happen just by opening this page.";
      $(id).append(empty);
    }
    rows.forEach((p) => $(id).append(card(p, kind)));
  }
  renderComparisonChart();
  $("refreshCompare").disabled =
    comparisonBusy || !library.list("compare").length || !navigator.onLine;
  $("storageNote").textContent = library.warning();
}
function refreshLibrary() {
  if (weather && selectedPlace) {
    const id = PlaceStore.place(selectedPlace).id;
    $("favoritePlace").setAttribute("aria-pressed", library.favorite(id));
    $("favoritePlace").textContent = library.favorite(id)
      ? "Favorite saved"
      : "Save favorite";
    $("comparePlace").textContent = library
      .list("compare")
      .some((p) => p.id === id)
      ? "View comparison"
      : "Add to comparison";
    const s = { fetchedAt: receipt.fetchedAt };
    $("freshness").textContent =
      `${ageLabel(s)} · model time ${stamp(weather.current.time * 1000)} · forecast timezone ${weather.timezone}. Refresh checks the 15-minute cache first.`;
    $("freshness").classList.toggle("stale", library.stale(s));
    document
      .querySelectorAll("[data-day]")
      .forEach((b) => (b.onclick = () => openDay(Number(b.dataset.day))));
  }
  renderCollections();
}
function changeDestination() {
  destination = ["places", "compare"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "weather";
  for (const name of ["weather", "places", "compare"])
    $(name + "View").hidden = destination !== name;
  document.querySelectorAll("[data-destination]").forEach((a) => {
    if (a.dataset.destination === destination)
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title =
    {
      weather: "Explore weather",
      places: "Your places",
      compare: "Compare places",
    }[destination] + " · Weather Board";
  placeSuggestions.close();
  renderCollections();
  const heading = $(destination + "View").querySelector("h1");
  heading.tabIndex = -1;
  if (document.activeElement?.closest(".rail"))
    heading.focus({ preventScroll: true });
}
function chart(points, label, formatter = temp) {
  const valid = points.filter((p) => finite(p.value));
  if (!valid.length) return "<p>No hourly temperature values available.</p>";
  const low = Math.min(...valid.map((p) => p.value)),
    high = Math.max(...valid.map((p) => p.value)),
    span = Math.max(high - low, 2);
  let runs = [],
    run = [];
  points.forEach((p, i) => {
    if (!finite(p.value)) {
      if (run.length) runs.push(run);
      run = [];
    } else
      run.push(
        `${24 + (i / Math.max(points.length - 1, 1)) * 432},${116 - ((p.value - low) / span) * 76}`,
      );
  });
  if (run.length) runs.push(run);
  return `<svg viewBox="0 0 480 150" role="img" aria-label="${esc(label)}">${runs.map((r) => `<polyline points="${r.join(" ")}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`).join("")}<text x="24" y="22" fill="currentColor">${esc(formatter(high))} high</text><text x="456" y="22" text-anchor="end" fill="currentColor">${esc(formatter(low))} low</text></svg>`;
}
function openDay(index) {
  const time = weather.daily.time[index],
    rows = PlaceStore.hoursForDay(weather, time);
  $("dayTitle").textContent = local(time, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  $("daySummary").textContent =
    `${selectedPlace.name} · ${OpenMeteo.conditions(weather.daily.weather_code?.[index])[0]} · ${temp(weather.daily.temperature_2m_min?.[index])} low / ${temp(weather.daily.temperature_2m_max?.[index])} high`;
  $("dayCaption").textContent =
    `${weather.timezone} · ${units === "imperial" ? "°F" : "°C"} · fetched ${stamp(receipt.fetchedAt)}${library.stale(receipt) ? " · stale saved forecast" : ""}`;
  $("dayRows").innerHTML =
    rows
      .map(
        ({ time, index }) =>
          `<tr><th scope="row">${esc(local(time, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }))}</th><td>${temp(weather.hourly.temperature_2m?.[index])}</td><td>${finite(weather.hourly.precipitation_probability?.[index]) ? number(weather.hourly.precipitation_probability[index]) + "%" : "Unavailable"}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="3">Hourly data unavailable for this day.</td></tr>';
  $("dayChart").innerHTML = chart(
    rows.map(({ time, index }) => ({
      time,
      value: weather.hourly.temperature_2m?.[index],
    })),
    "Hourly temperature; exact values in the table.",
  );
  $("dayDialog").classList.remove("expanded");
  $("expandDetail").setAttribute("aria-expanded", "false");
  $("dayDialog").showModal();
}
function renderComparisonChart() {
  const snapshots = library
    .list("compare")
    .map((p) => validSnapshot(library.snapshot(p.id)))
    .filter(Boolean);
  const host = $("compareChart");
  host.hidden = snapshots.length < 2;
  if (snapshots.length < 2) return;
  const start = Math.max(
    ...snapshots.map((s) => Math.floor(s.data.current.time / 3600) * 3600),
  );
  const times = [...new Set(snapshots.flatMap((s) => s.data.hourly.time))]
    .filter((t) => t >= start && t < start + 86400)
    .sort((a, b) => a - b);
  const series = snapshots.map((s) =>
    times.map((time) => ({
      time,
      value: s.data.hourly.temperature_2m?.[s.data.hourly.time.indexOf(time)],
    })),
  );
  const values = series
    .flat()
    .filter((p) => finite(p.value))
    .map((p) => p.value);
  const low = Math.min(...values),
    high = Math.max(...values),
    span = Math.max(high - low, 2);
  const colors = [
    "var(--md-sys-color-primary)",
    "var(--md-sys-color-tertiary)",
    "var(--md-sys-color-on-surface)",
  ];
  const lines = series
    .map((points, idx) => {
      let runs = [],
        run = [];
      points.forEach((p, i) => {
        if (!finite(p.value)) {
          if (run.length) runs.push(run);
          run = [];
        } else
          run.push(
            `${24 + (i / Math.max(times.length - 1, 1)) * 432},${116 - ((p.value - low) / span) * 76}`,
          );
      });
      if (run.length) runs.push(run);
      return runs
        .map(
          (r) =>
            `<polyline points="${r.join(" ")}" fill="none" stroke="${colors[idx]}" stroke-width="3" ${idx === 2 ? 'stroke-dasharray="6 4"' : ""}/>`,
        )
        .join("");
    })
    .join("");
  host.innerHTML = `<h2>Next 24 hours, together</h2><p class="local-note">The same UTC instants for every place. Values use ${units === "imperial" ? "°F" : "°C"}; each card names its local timezone. Saved forecasts may have different fetch times.</p><div class="compare-key">${snapshots.map((s, i) => `<span style="--series:${colors[i]}">${esc(s.place.name)}${i === 2 ? " (dashed)" : ""}</span>`).join("")}</div>${values.length ? `<svg viewBox="0 0 480 150" role="img" aria-label="Compared hourly temperatures, exact values in table below.">${lines}<text fill="currentColor" x="24" y="22">${temp(high)} high</text><text fill="currentColor" x="456" y="22" text-anchor="end">${temp(low)} low</text></svg>` : "<p>Hourly values unavailable.</p>"}<details><summary>Show exact hourly values</summary><div class="detail-table-wrap"><table class="detail-table"><caption>Aligned UTC hours</caption><thead><tr><th scope="col">UTC time</th>${snapshots.map((s) => `<th scope="col">${esc(s.place.name)}<br>${esc(s.data.timezone)}</th>`).join("")}</tr></thead><tbody>${times.map((t, i) => `<tr><th scope="row">${esc(new Date(t * 1000).toISOString().slice(5, 16).replace("T", " "))}</th>${series.map((points) => `<td>${temp(points[i].value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}
$("refreshCompare").onclick = async () => {
  if (comparisonBusy || !navigator.onLine) return;
  comparisonBusy = true;
  const version = ++comparisonVersion;
  compareErrors.clear();
  renderCollections();
  const places = library.list("compare");
  let done = 0;
  for (const p of places) {
    $("compareStatus").textContent =
      `Checking ${p.name} (${++done} of ${places.length})…`;
    try {
      const r = await policy.request(OpenMeteo.forecastURL(p), { ttl: 900000 });
      if (version !== comparisonVersion) break;
      library.save(p, OpenMeteo.validate(r.data), r.fetchedAt);
    } catch (e) {
      if (version !== comparisonVersion) break;
      compareErrors.set(
        p.id,
        e.message + " Last saved data remains visible if available.",
      );
    }
  }
  comparisonBusy = false;
  if (version !== comparisonVersion) {
    renderCollections();
    updateUsage();
    return;
  }
  $("compareStatus").textContent = compareErrors.size
    ? "Some forecasts could not be refreshed. See each place for details."
    : "Comparison checked. Cached forecasts keep their original fetch time.";
  renderCollections();
  updateUsage();
};
$("favoritePlace").onclick = () => {
  try {
    library.toggle(selectedPlace);
    refreshLibrary();
  } catch (e) {
    status(e.message, true);
  }
};
$("comparePlace").onclick = () => {
  try {
    library.compare(selectedPlace);
    location.hash = "compare";
    renderCollections();
  } catch (e) {
    status(e.message, true);
  }
};
$("importForecast").onclick = () => {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("wb-import-")) sessionStorage.removeItem(key);
    const id = crypto.randomUUID();
    const draft = {
      payload: PlaceStore.importPayload(
        { place: selectedPlace, data: weather },
        OpenMeteo.conditions(weather.current.weather_code)[0],
      ),
      fetchedAt: receipt.fetchedAt,
      timezone: weather.timezone,
      createdAt: Date.now(),
    };
    sessionStorage.setItem("wb-import-" + id, JSON.stringify(draft));
    location.href = "workspace.html?import=" + encodeURIComponent(id);
  } catch {
    status(
      "A private draft could not be created. Enable session storage to import.",
      true,
    );
  }
};
$("closeDay").onclick = () => $("dayDialog").close();
$("expandDetail").onclick = () => {
  const expanded = $("dayDialog").classList.toggle("expanded");
  $("expandDetail").setAttribute("aria-expanded", expanded);
  $("expandDetail").setAttribute(
    "aria-label",
    expanded ? "Collapse day details" : "Expand day details",
  );
};
for (const id of ["dayDialog", "clearDialog"])
  $(id).addEventListener("click", (e) => {
    if (e.target === $(id)) {
      const r = $(id).getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        $(id).close();
    }
  });
$("clearPlaces").onclick = () => $("clearDialog").showModal();
$("cancelClear").onclick = () => $("clearDialog").close();
$("confirmClear").onclick = () => {
  ++forecastVersion;
  ++comparisonVersion;
  placeSuggestions.close();
  compareErrors.clear();
  $("compareStatus").textContent = "Local weather data cleared.";
  library.clear();
  weather = null;
  selectedPlace = null;
  receipt = null;
  $("weatherContent").hidden = true;
  $("welcome").hidden = false;
  status("Local weather data cleared. Request counters are retained.");
  $("clearDialog").close();
  render();
  renderCollections();
};
function connectivity() {
  $("offlineNote").hidden = navigator.onLine;
  refreshLibrary();
}
window.addEventListener("hashchange", changeDestination);
window.addEventListener("online", connectivity);
window.addEventListener("offline", connectivity);
window.addEventListener("focus", () => {
  if (weather) refreshLibrary();
});
const lastSnapshot = validSnapshot(library.snapshot(library.latest()));
if (lastSnapshot) showSnapshot(lastSnapshot);
changeDestination();
connectivity();

// Update age labels without a network request or replacing focused controls.
function updateAgeLabels() {
  document.querySelectorAll("[data-snapshot-time]").forEach((el) => {
    const snapshot = { fetchedAt: Number(el.dataset.snapshotTime) };
    el.textContent = ageLabel(snapshot);
    el.closest(".freshness").classList.toggle("stale", library.stale(snapshot));
  });
  if (weather && receipt) {
    $("freshness").textContent =
      `${ageLabel(receipt)} · model time ${stamp(weather.current.time * 1000)} · forecast timezone ${weather.timezone}. Refresh checks the 15-minute cache first.`;
    $("freshness").classList.toggle("stale", library.stale(receipt));
  }
}
setInterval(updateAgeLabels, 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateAgeLabels();
});
