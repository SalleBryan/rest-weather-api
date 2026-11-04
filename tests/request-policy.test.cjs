const test = require("node:test");
const assert = require("node:assert/strict");
const { create, apiBase } = require("../web/request-policy.js");
const OpenMeteo = require("../web/open-meteo.js");
test("clearing local weather during a read prevents late cache repopulation", async () => {
  const state = storage();
  let release;
  const guard = create({
    storage: state,
    fetcher: () => new Promise((resolve) => (release = resolve)),
  });
  const read = guard.request("https://provider.test", { ttl: 1000 });
  await new Promise((resolve) => setImmediate(resolve));
  state.setItem("wb-cache-generation", JSON.stringify("cleared"));
  release(response());
  await read;
  assert.equal(state.getItem("wb-cache-v1"), undefined);
});
test("owner headers are sent only for uncached BYO requests and never persisted or coalesced across credentials", async () => {
  const state = storage();
  let calls = [];
  const guard = create({
    storage: state,
    fetcher: async (url, options) => {
      calls.push(options);
      return response();
    },
  });
  await assert.rejects(
    guard.request("https://journal.test", {
      headers: { Authorization: "Bearer private" },
    }),
    /Authenticated/,
  );
  await assert.rejects(
    guard.request("https://journal.test", {
      group: "byo",
      ttl: 1000,
      headers: { Authorization: "Bearer private" },
    }),
    /Authenticated/,
  );
  await Promise.all(
    ["first-secret", "second-secret"].map((token) =>
      guard.request("https://journal.test", {
        group: "byo",
        headers: { Authorization: token },
      }),
    ),
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].cache, "no-store");
  assert.equal(calls[0].credentials, "omit");
  assert.deepEqual(
    calls.map((c) => c.headers.Authorization),
    ["first-secret", "second-secret"],
  );
  assert.equal(state.getItem("wb-cache-v1"), undefined);
  assert(!state.getItem("wb-budget-v1-byo").includes("secret"));
});
const storage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
};
const response = (status = 200, data = { ok: true }, retry = null) => ({
  ok: status < 400,
  status,
  json: async () => data,
  headers: { get: () => retry },
});

test("coalesces duplicate reads and serves a persistent cache without spending budget", async () => {
  const state = storage();
  let calls = 0,
    time = 1000000;
  const options = {
    storage: state,
    now: () => time,
    fetcher: async () => {
      calls++;
      return response();
    },
  };
  const guard = create(options);
  await Promise.all([
    guard.request("https://example.test/a", { ttl: 1000 }),
    guard.request("https://example.test/a", { ttl: 1000 }),
  ]);
  assert.equal(calls, 1);
  assert.equal(guard.usage("weather").day, 1);
  assert.equal(
    (await create(options).request("https://example.test/a", { ttl: 1000 }))
      .cached,
    true,
  );
  assert.equal(calls, 1);
  time += 1001;
  await guard.request("https://example.test/a", { ttl: 1000 });
  assert.equal(calls, 2);
});
test("caps a minute, persists daily counts across reloads, separates BYO, and resets at UTC midnight", async () => {
  const state = storage();
  let calls = 0,
    time = Date.parse("2026-11-03T00:00:01Z");
  const options = {
    storage: state,
    now: () => time,
    fetcher: async () => {
      calls++;
      return response();
    },
  };
  let guard = create(options);
  for (let dayCall = 0; dayCall < 100; dayCall++) {
    if (dayCall && dayCall % 10 === 0) time += 61000;
    await guard.request("https://example.test/" + dayCall);
    if (dayCall === 9)
      await assert.rejects(
        guard.request("https://example.test/blocked"),
        /Minute limit/,
      );
    guard = create(options);
  }
  time += 61000;
  await assert.rejects(
    guard.request("https://example.test/day-blocked"),
    /Daily browser limit/,
  );
  assert.equal(calls, 100);
  await guard.request("https://own-api.test/weathers", { group: "byo" });
  assert.equal(calls, 101);
  time = Date.parse("2026-11-04T00:00:01Z");
  await guard.request("https://example.test/new-day");
  assert.equal(guard.usage("weather").day, 1);
});
test("429 persists a cooldown and never retries automatically", async () => {
  let calls = 0,
    time = 1000000;
  const state = storage();
  const options = {
    storage: state,
    now: () => time,
    fetcher: async () => {
      calls++;
      return response(429, {}, "120");
    },
  };
  await assert.rejects(
    create(options).request("https://example.test"),
    /Provider request limit/,
  );
  time += 61000;
  await assert.rejects(
    create(options).request("https://example.test"),
    /cooldown/,
  );
  assert.equal(calls, 1);
});
test("failed requests count, unsafe storage fails closed, mutations are never coalesced", async () => {
  let calls = 0;
  const guard = create({
    storage: storage(),
    fetcher: async () => {
      calls++;
      throw Error("Offline");
    },
  });
  await assert.rejects(guard.request("https://example.test"), /Offline/);
  assert.equal(guard.usage("weather").day, 1);
  const broken = create({
    storage: { getItem: () => "{broken" },
    fetcher: async () => {
      calls++;
      return response();
    },
  });
  await assert.rejects(broken.request("https://example.test"));
  assert.equal(calls, 1);
  const writes = create({
    storage: storage(),
    fetcher: async () => {
      calls++;
      return response();
    },
  });
  await Promise.all([
    writes.request("https://example.test", { method: "POST", body: "{}" }),
    writes.request("https://example.test", { method: "POST", body: "{}" }),
  ]);
  assert.equal(calls, 3);
});
test("base URLs reject embedded secrets and insecure remote hosts", () => {
  assert.equal(
    apiBase("https://example.test/dev/"),
    "https://example.test/dev",
  );
  assert.equal(
    apiBase("http://127.0.0.1:3000/dev"),
    "http://127.0.0.1:3000/dev",
  );
  for (const url of [
    "http://example.test/dev",
    "https://user:pass@example.test",
    "https://example.test?apikey=secret",
    "https://example.test/#key",
    "file:///tmp/test",
  ])
    assert.throws(() => apiBase(url));
});
test("worldwide requests use the free host, one location, seven days, and at most ten variables", () => {
  const url = new URL(
    OpenMeteo.forecastURL({ latitude: -33.86, longitude: 151.2 }),
  );
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.equal(url.searchParams.get("forecast_days"), "7");
  assert.equal(url.searchParams.get("timeformat"), "unixtime");
  assert.equal(url.searchParams.has("apikey"), false);
  assert.equal(
    ["current", "hourly", "daily"].flatMap((key) =>
      url.searchParams.get(key).split(","),
    ).length,
    10,
  );
  assert.throws(() => OpenMeteo.coordinates("", 10));
  assert.throws(() => OpenMeteo.coordinates(91, 10));
  assert.throws(() => OpenMeteo.coordinates(1, -181));
  assert.equal(OpenMeteo.conditions(null)[0], "Unknown conditions");
  assert.equal(OpenMeteo.conditions(95)[1], "stormy");
  assert.throws(() =>
    OpenMeteo.validate({
      current: { time: 1 },
      hourly: { time: [] },
      daily: { time: [] },
      timezone: "not/a-zone",
    }),
  );
});
