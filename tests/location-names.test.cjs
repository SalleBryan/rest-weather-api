const test = require("node:test");
const assert = require("node:assert/strict");
const Names = require("../web/location-names.js");
const Store = require("../web/place-store.js");
const point = { latitude: 48.86, longitude: 2.35 };
const result = {
  ...point,
  lookupSource: "coordinates",
  city: "Paris",
  locality: "Saint-Germain",
  principalSubdivision: "Ile-de-France",
  countryName: "France",
};
test("device coordinates resolve to city, region and country without replacing coordinates", () => {
  const p = Names.parse(result, point);
  assert.equal(p.name, "Paris");
  assert.equal(p.admin1, "Ile-de-France");
  assert.equal(p.country, "France");
  assert.equal(p.latitude, 48.86);
  assert.equal(p.deviceLocation, true);
  assert.equal(Store.place(p).deviceLocation, true);
  assert.equal(
    Store.place({ name: "Current location", ...point }).deviceLocation,
    true,
    "legacy snapshots retain the device marker",
  );
});
test("village names are used when no city is returned, and empty names remain unknown", () => {
  assert.equal(Names.parse({ ...result, city: "  " }, point).name, "Saint-Germain");
  assert.equal(Names.parse({ ...result, city: "", locality: "" }, point), null);
});
test("IP-based and mismatched reverse results cannot mislabel a device location", () => {
  assert.equal(
    Names.parse({ ...result, lookupSource: "ip address" }, point),
    null,
  );
  assert.equal(Names.parse({ ...result, latitude: 48.85 }, point), null);
  assert.equal(Names.parse(null, point), null);
  assert.equal(Names.parse({ ...result, latitude: NaN }, point), null);
});
test("reverse requests use one fixed free origin with explicit coordinates, including zero", () => {
  const u = new URL(Names.url({ latitude: 0, longitude: 0 }));
  assert.equal(u.origin, "https://api.bigdatacloud.net");
  assert.equal(u.searchParams.get("latitude"), "0");
  assert.equal(u.searchParams.get("longitude"), "0");
  assert.equal(u.searchParams.get("localityLanguage"), "en");
  assert.equal(u.searchParams.has("key"), false);
  assert.throws(() => Names.url({ latitude: 91, longitude: 0 }), /Invalid/);
});
