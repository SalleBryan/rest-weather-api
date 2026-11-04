const test = require("node:test");
const assert = require("node:assert/strict");
const {
  create,
  place,
  hoursForDay,
  importPayload,
} = require("../web/place-store.js");
function storage() {
  const m = new Map();
  return {
    getItem: (k) => m.get(k),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
}
const p = (i) => ({ name: "City " + i, latitude: i, longitude: 0 });
const data = {
  timezone: "UTC",
  current: {
    time: 0,
    temperature_2m: 0,
    relative_humidity_2m: 0,
    wind_speed_10m: 0,
  },
  hourly: { time: [0] },
  daily: { time: [0] },
};
test("bounded lists deduplicate coordinates, retain favorites and snapshot timestamps on reload", () => {
  const s = storage(),
    lib = create(s, () => 1000000);
  for (let i = 0; i < 12; i++) lib.toggle(p(i));
  assert.throws(() => lib.toggle(p(13)), /12 favorite/);
  for (let i = 12; i < 30; i++) lib.save(p(i), data, 10);
  assert.equal(lib.list("recents").length, 8);
  lib.compare(p(28));
  lib.compare(p(27));
  lib.compare(p(26));
  lib.compare(p(28));
  assert.throws(() => lib.compare(p(25)), /three/);
  const again = create(s, () => 1000000);
  assert.equal(again.list("favorites").length, 12);
  assert.equal(again.list("compare").length, 3);
  assert.equal(again.snapshot(place(p(29)).id).fetchedAt, 10);
  assert.equal(again.stale(again.snapshot(place(p(29)).id)), true);
  lib.clear();
  assert.equal(create(s).list("favorites").length, 0);
});
test("day drilldown uses timezone calendar dates across DST and includes repeated hours", () => {
  const first = Date.parse("2026-11-01T04:00:00Z") / 1000;
  const d = {
    timezone: "America/New_York",
    hourly: { time: Array.from({ length: 50 }, (_, i) => first + i * 3600) },
  };
  assert.equal(hoursForDay(d, first).length, 25);
  assert.equal(hoursForDay(d, first + 26 * 3600).length, 24);
});
test("import retains zero, UTC model timestamp, coordinates and provider; rejects invalid measurements", () => {
  const result = importPayload({ place: p(0), data }, "Clear sky");
  assert.equal(result.temperatureC, 0);
  assert.equal(result.humidityPct, 0);
  assert.equal(result.windKph, 0);
  assert.equal(result.source, "imported");
  assert.equal(result.provider, "Open-Meteo");
  assert.equal(result.observedAt, "1970-01-01T00:00:00.000Z");
  assert.equal(result.latitude, 0);
  assert.equal(
    importPayload(
      {
        place: p(0),
        data: {
          ...data,
          current: { ...data.current, temperature_2m: Infinity },
        },
      },
      "Unknown",
    ).temperatureC,
    null,
  );
});
test("damaged storage gives a recoverable warning and does not trigger requests", () => {
  const lib = create({
    getItem: () => "{bad",
    setItem: () => {
      throw Error("disabled");
    },
  });
  assert.equal(lib.list("recents").length, 0);
  assert.match(lib.warning(), /could not/);
  lib.remember(p(1));
  assert.match(lib.warning(), /unavailable/);
  assert.throws(() => place({ ...p(1), latitude: NaN }), /Invalid/);
});
