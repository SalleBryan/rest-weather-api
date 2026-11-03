/* Pure history helpers shared by the dashboard and Node's built-in tests. */
(function (root) {
  'use strict';
  const metrics = {
    temperatureC: { label: 'Temperature', metric: '°C', imperial: '°F' },
    humidityPct: { label: 'Humidity', metric: '%', imperial: '%' },
    windKph: { label: 'Wind speed', metric: 'km/h', imperial: 'mph' },
  };
  const townKey = town => String(town || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const time = item => Date.parse(item.observedAt || item.createdAt || '');
  function value(item, metric, units = 'metric') {
    const raw = item[metric];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    return units !== 'imperial' ? raw : metric === 'temperatureC' ? raw * 9 / 5 + 32 : metric === 'windKph' ? raw / 1.609344 : raw;
  }
  function select(items, town, from = '', to = '') {
    const low = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const high = to ? new Date(to + 'T00:00:00') : null;
    if (high) high.setDate(high.getDate() + 1);
    return items.filter(item => townKey(item.town) === town &&
      ((!from && !to) || (Number.isFinite(time(item)) && time(item) >= low && (!high || time(item) < high.getTime()))))
      .sort((a, b) => (Number.isFinite(time(a)) ? time(a) : Infinity) - (Number.isFinite(time(b)) ? time(b) : Infinity));
  }
  function chart(items, metric, units) {
    const dated = items.filter(item => Number.isFinite(time(item)));
    const values = dated.map(item => value(item, metric, units)).filter(v => v !== null);
    if (!values.length) return { segments: [], count: 0 };
    const min = Math.min(...values), max = Math.max(...values);
    const pad = Math.max((max - min) * .15, 1);
    const low = min - pad, high = max + pad;
    const start = time(dated[0]), end = time(dated[dated.length - 1]);
    const segments = []; let segment = [];
    for (const item of dated) {
      const v = value(item, metric, units);
      if (v === null) { if (segment.length) segments.push(segment); segment = []; continue; }
      segment.push({ x: end === start ? 340 : 64 + (time(item) - start) / (end - start) * 552,
        y: 184 - (v - low) / (high - low) * 156, value: v, time: time(item) });
    }
    if (segment.length) segments.push(segment);
    return { segments, count: values.length, min, max, low, high, start, end };
  }
  const api = { metrics, townKey, time, value, select, chart };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherHistory = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
