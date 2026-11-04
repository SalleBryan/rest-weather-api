/* Local place library. No credentials or journal responses belong here. */
(function (root) {
  "use strict";
  const KEY = "wb-places-v1";
  const finite = (x) => typeof x === "number" && Number.isFinite(x);
  function place(raw) {
    if (
      !raw ||
      !finite(raw.latitude) ||
      !finite(raw.longitude) ||
      Math.abs(raw.latitude) > 90 ||
      Math.abs(raw.longitude) > 180 ||
      typeof raw.name !== "string" ||
      !raw.name.trim()
    )
      throw Error("Invalid saved place");
    const clean = {
      name: raw.name.trim().slice(0, 120),
      latitude: raw.latitude,
      longitude: raw.longitude,
    };
    for (const key of ["admin1", "country"])
      if (typeof raw[key] === "string") clean[key] = raw[key].slice(0, 120);
    if (raw.deviceLocation === true || raw.name === "Current location")
      clean.deviceLocation = true;
    clean.id = clean.latitude.toFixed(4) + "," + clean.longitude.toFixed(4);
    return clean;
  }
  function dayKey(time, timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(time * 1000));
    return ["year", "month", "day"]
      .map((type) => parts.find((p) => p.type === type).value)
      .join("-");
  }
  function hoursForDay(data, dayTime) {
    const key = dayKey(dayTime, data.timezone);
    return data.hourly.time
      .map((time, index) => ({ time, index }))
      .filter((it) => dayKey(it.time, data.timezone) === key);
  }
  function importPayload(snapshot, condition) {
    const { place: p, data } = snapshot,
      c = data.current;
    const payload = {
      town: [p.name, p.country].filter(Boolean).join(", ").slice(0, 60),
      weather: condition,
      latitude: p.latitude,
      longitude: p.longitude,
      observedAt: new Date(c.time * 1000).toISOString(),
      source: "imported",
      provider: "Open-Meteo",
    };
    for (const [field, value, low, high] of [
      ["temperatureC", c.temperature_2m, -100, 70],
      ["humidityPct", c.relative_humidity_2m, 0, 100],
      ["windKph", c.wind_speed_10m, 0, 500],
    ])
      payload[field] =
        finite(value) && value >= low && value <= high ? value : null;
    return payload;
  }
  function create(storage, now = Date.now) {
    let state = {
        places: [],
        favorites: [],
        recents: [],
        compare: [],
        snapshots: [],
      },
      warning = "";
    function read() {
      try {
        const raw = JSON.parse(storage.getItem(KEY) || "null");
        if (!raw) return;
        state.places = (Array.isArray(raw.places) ? raw.places : [])
          .slice(0, 32)
          .map(place);
        const valid = new Set(state.places.map((p) => p.id));
        for (const [list, max] of [
          ["favorites", 12],
          ["recents", 8],
          ["compare", 3],
        ])
          state[list] = [...new Set(Array.isArray(raw[list]) ? raw[list] : [])]
            .filter((id) => valid.has(id))
            .slice(0, max);
        state.snapshots = (Array.isArray(raw.snapshots) ? raw.snapshots : [])
          .filter(
            (s) =>
              valid.has(s.id) &&
              finite(s.fetchedAt) &&
              s.fetchedAt <= now() + 60000 &&
              s.data?.current &&
              Array.isArray(s.data?.hourly?.time) &&
              s.data.hourly.time.length <= 200 &&
              Array.isArray(s.data?.daily?.time) &&
              s.data.daily.time.length <= 8,
          )
          .slice(0, 8);
      } catch {
        state = {
          places: [],
          favorites: [],
          recents: [],
          compare: [],
          snapshots: [],
        };
        warning =
          "Saved places could not be read. New requests still use the separate request guard.";
      }
    }
    read();
    function persist() {
      const keep = new Set([
        ...state.favorites,
        ...state.recents,
        ...state.compare,
        ...state.snapshots.map((s) => s.id),
      ]);
      state.places = state.places.filter((p) => keep.has(p.id));
      try {
        storage.setItem(KEY, JSON.stringify(state));
        warning = "";
      } catch {
        warning =
          "Browser storage is full or unavailable. Changes will last only in this tab.";
      }
    }
    function remember(raw) {
      const p = place(raw);
      state.places = [p, ...state.places.filter((it) => it.id !== p.id)];
      state.recents = [
        p.id,
        ...state.recents.filter((id) => id !== p.id),
      ].slice(0, 8);
      persist();
      return p;
    }
    return {
      list: (kind) =>
        (state[kind] || [])
          .map((id) => state.places.find((p) => p.id === id))
          .filter(Boolean),
      favorite: (id) => state.favorites.includes(id),
      snapshot: (id) => {
        const s = state.snapshots.find((s) => s.id === id),
          p = state.places.find((p) => p.id === id);
        return s && p ? { ...s, place: p } : null;
      },
      latest: () => state.recents[0],
      remember,
      save(raw, data, fetchedAt) {
        const p = remember(raw);
        state.snapshots = [
          { id: p.id, data, fetchedAt },
          ...state.snapshots.filter((s) => s.id !== p.id),
        ].slice(0, 8);
        persist();
        return p;
      },
      toggle(raw) {
        const p = place(raw);
        if (!state.favorites.includes(p.id) && state.favorites.length >= 12)
          throw Error(
            "Your 12 favorite places are full. Remove one in Places first.",
          );
        remember(p);
        state.favorites = state.favorites.includes(p.id)
          ? state.favorites.filter((id) => id !== p.id)
          : [...state.favorites, p.id];
        persist();
      },
      compare(raw) {
        const p = place(raw);
        if (state.compare.includes(p.id)) return;
        if (state.compare.length >= 3)
          throw Error(
            "Compare holds three places. Remove one before adding another.",
          );
        remember(p);
        state.compare.push(p.id);
        persist();
      },
      remove(kind, id) {
        if (!["favorites", "recents", "compare"].includes(kind)) return;
        state[kind] = state[kind].filter((it) => it !== id);
        persist();
      },
      clear() {
        state = {
          places: [],
          favorites: [],
          recents: [],
          compare: [],
          snapshots: [],
        };
        persist();
        try {
          storage.removeItem("wb-cache-v1");
          storage.setItem(
            "wb-cache-generation",
            JSON.stringify(Math.random().toString(36)),
          );
        } catch {}
      },
      warning: () => warning,
      stale: (s) => !s || now() - s.fetchedAt >= 900000,
    };
  }
  const api = { create, place, dayKey, hoursForDay, importPayload };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PlaceStore = api;
})(typeof globalThis === "undefined" ? this : globalThis);
