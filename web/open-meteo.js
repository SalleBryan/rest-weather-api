(function (root) {
  "use strict";
  const conditions = (code) =>
    code === 0
      ? ["Clear sky", "sunny", "sunny"]
      : [1, 2, 3].includes(code)
        ? ["Partly cloudy", "cloudy", "partly_cloudy_day"]
        : [45, 48].includes(code)
          ? ["Fog", "foggy", "foggy"]
          : [51, 53, 55, 56, 57].includes(code)
            ? ["Drizzle", "drizzle", "rainy_light"]
            : [71, 73, 75, 77, 85, 86].includes(code)
              ? ["Snow", "cold", "ac_unit"]
              : [95, 96, 99].includes(code)
                ? ["Thunderstorms", "stormy", "thunderstorm"]
                : [61, 63, 65, 66, 67, 80, 81, 82].includes(code)
                  ? ["Rain", "rainy", "rainy"]
                  : ["Unknown conditions", "board", "cloud"];
  function coordinates(latitude, longitude) {
    if (
      ![latitude, longitude].every(
        (value) => typeof value === "number" || typeof value === "string",
      )
    )
      throw Error("Provide numeric latitude and longitude.");
    const lat = Number(latitude),
      lon = Number(longitude);
    if (
      String(latitude).trim() === "" ||
      String(longitude).trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      throw Error(
        "Enter latitude from -90 to 90 and longitude from -180 to 180.",
      );
    return { latitude: lat, longitude: lon };
  }
  function forecastURL(location) {
    const point = coordinates(location.latitude, location.longitude);
    return (
      "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        ...point,
        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        hourly: "temperature_2m,precipitation_probability",
        daily: "temperature_2m_max,temperature_2m_min,weather_code",
        timezone: "auto",
        timeformat: "unixtime",
        forecast_days: "7",
        temperature_unit: "celsius",
        wind_speed_unit: "kmh",
      })
    );
  }
  function validate(data) {
    if (
      !data?.current ||
      !Number.isFinite(data.current.time) ||
      !Array.isArray(data.hourly?.time) ||
      !Array.isArray(data.daily?.time) ||
      typeof data.timezone !== "string" ||
      !data.hourly.time.length ||
      data.hourly.time.length > 200 ||
      !data.daily.time.length ||
      data.daily.time.length > 8 ||
      ![data.current.time, ...data.hourly.time, ...data.daily.time].every(
        (time) => Number.isFinite(time) && Math.abs(time) < 8640000000000,
      )
    )
      throw Error("Weather data is incomplete. Try another location.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: data.timezone });
    } catch {
      throw Error("The provider returned an invalid timezone.");
    }
    return data;
  }
  const api = { conditions, coordinates, forecastURL, validate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OpenMeteo = api;
})(typeof globalThis === "undefined" ? this : globalThis);
