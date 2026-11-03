const { test } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../web/history.js');
const rows = [
  { town:' Buea ', observedAt:'2026-11-03T01:00:00Z', temperatureC:20, windKph:0 },
  { town:'BUEA', observedAt:'2026-11-03T02:00:00Z', temperatureC:null },
  { town:'Buea', createdAt:'2026-11-03T04:00:00Z', temperatureC:24 },
  { town:'Douala', observedAt:'2026-11-03T01:00:00Z', temperatureC:32 },
];
test('town selection is case/whitespace insensitive, sorted by observation time', () => {
  assert.equal(h.townKey('  New   York  '), 'new york');
  assert.equal(h.townKey('Ｂｕｅａ'), 'buea');
  assert.equal(h.select(rows.reverse(), 'buea').length, 3);
  assert.equal(h.select(rows, 'buea')[0].temperatureC, 20);
});
test('date filters include an entire local day and exclude the next day', () => {
  const data = [0, 12, 23].map(hour => ({town:'Buea', observedAt:new Date(2026,10,3,hour,59).toISOString()}));
  data.push({town:'Buea', observedAt:new Date(2026,10,4,0,0).toISOString()});
  assert.equal(h.select(data,'buea','2026-11-03','2026-11-03').length, 3);
});
test('unit conversion preserves zero and unknown values', () => {
  assert.equal(h.value({temperatureC:0},'temperatureC','imperial'),32);
  assert.equal(h.value({windKph:0},'windKph','imperial'),0);
  assert.equal(h.value({windKph:1.609344},'windKph','imperial'),1);
  assert.equal(h.value({humidityPct:null},'humidityPct'),null);
  assert.equal(h.value({},'temperatureC'),null);
});
test('charts break at missing measurements and use actual timestamp spacing', () => {
  const model = h.chart(h.select(rows,'buea'),'temperatureC','metric');
  assert.equal(model.segments.length,2);
  assert.equal(model.count,2);
  assert.equal(model.segments[0][0].x,64);
  assert.equal(model.segments[1][0].x,616);
});
test('single points, flat series and undated rows never produce invalid SVG coordinates', () => {
  const dated = { town:'Buea', createdAt:'2026-11-03T01:00:00Z',temperatureC:0 };
  for (const data of [[dated], [dated,dated]]) {
    const model=h.chart(data,'temperatureC','metric');
    assert.ok(model.segments.flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  }
  assert.equal(h.chart([{temperatureC:20}], 'temperatureC','metric').count,0);
  assert.equal(h.chart([dated], 'humidityPct','metric').count,0);
  assert.equal(h.select([{town:'Buea'}],'buea').length,1);
  assert.equal(h.select([{town:'Buea'}],'buea','2026-11-03').length,0);
});
