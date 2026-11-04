/* Reverse geocoding is called only after a fresh, permitted device position. */
(function (root) {
  "use strict";
  function url(point) {
    if (
      ![point?.latitude, point?.longitude].every(Number.isFinite) ||
      Math.abs(point.latitude) > 90 ||
      Math.abs(point.longitude) > 180
    )
      throw Error("Invalid location coordinates");
    return (
      "https://api.bigdatacloud.net/data/reverse-geocode-client?" +
      new URLSearchParams({
        latitude: point.latitude,
        longitude: point.longitude,
        localityLanguage: "en",
      })
    );
  }
  function parse(data, point) {
    // Never substitute an IP-based answer or the provider's coordinates for the device point.
    if (
      data?.lookupSource !== "coordinates" ||
      ![data.latitude, data.longitude].every(Number.isFinite) ||
      Math.abs(data.latitude - point.latitude) > 0.0001 ||
      Math.abs(data.longitude - point.longitude) > 0.0001
    )
      return null;
    const text = (value) =>
      typeof value === "string" ? value.trim().slice(0, 120) : "";
    const name = text(data.city) || text(data.locality);
    return name
      ? {
          ...point,
          name,
          admin1: text(data.principalSubdivision),
          country: text(data.countryName),
          deviceLocation: true,
        }
      : null;
  }
  const api = { url, parse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LocationNames = api;
})(typeof globalThis === "undefined" ? this : globalThis);
