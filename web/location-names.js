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
  function nearestCity(point, cities) {
    const radians = Math.PI / 180;
    const latitude = point.latitude * radians;
    // Compare haversine values directly to a 15 km distance.
    let closest = Math.sin(15 / (2 * 6371)) ** 2;
    let match = null;
    for (const [name, cityLat, cityLon, country] of cities) {
      const distance =
        Math.sin((cityLat * radians - latitude) / 2) ** 2 +
        Math.cos(latitude) * Math.cos(cityLat * radians) *
          Math.sin(((cityLon - point.longitude) * radians) / 2) ** 2;
      if (distance <= closest) {
        closest = distance;
        match = { name, country };
      }
    }
    if (!match) return null;
    const countryNames = Intl.DisplayNames && new Intl.DisplayNames("en", { type: "region" });
    return {
      ...point,
      name: "Near " + match.name,
      country: countryNames ? countryNames.of(match.country) : match.country,
      deviceLocation: true,
    };
  }
  const api = { url, parse, nearestCity };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LocationNames = api;
})(typeof globalThis === "undefined" ? this : globalThis);
