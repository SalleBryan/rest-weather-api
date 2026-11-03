import pytest


def test_measurements_round_trip_as_json_numbers(api):
    reading = dict(weather='Rainy', town='Buea', temperatureC=21.5,
                   humidityPct=87, windKph=0, latitude=4.156, longitude=9.232,
                   observedAt='2026-11-03T09:15:00+01:00')
    status, body, _ = api.call('create_weather', reading)
    assert status == 201
    item = body['item']
    assert item['source'] == 'manual'
    assert item['observedAt'] == '2026-11-03T08:15:00+00:00'
    status, saved, _ = api.call('get_weather', weather_id=item['id'])
    assert status == 200
    assert saved == item
    assert isinstance(saved['temperatureC'], (int, float))
    assert saved['humidityPct'] == 87
    assert saved['windKph'] == 0
    assert api.call('get_weathers')[1] == [item]


@pytest.mark.parametrize('extra', [
    {'temperatureC': -101}, {'temperatureC': 71}, {'temperatureC': True},
    {'temperatureC': '21'}, {'temperatureC': float('nan')},
    {'windKph': float('inf')}, {'humidityPct': 101}, {'windKph': -1},
    {'windKph': 1e-300},
    {'latitude': 91, 'longitude': 0}, {'latitude': 0},
    {'latitude': None, 'longitude': 0}, {'longitude': 181, 'latitude': 0},
    {'observedAt': '2026-11-03T09:00:00'}, {'observedAt': 'not a date'},
    {'observedAt': 123}, {'source': 'sensor'}, {'source': 'imported'},
    {'provider': 'Example provider'},
])
def test_invalid_measurements_rejected_on_create_and_update(api, extra):
    item = api.create()
    data = dict(weather='Cold', town='Douala', **extra)
    assert api.call('create_weather', data)[0] == 400
    assert api.call('update_weather', data, weather_id=item['id'])[0] == 400
    assert api.call('get_weather', weather_id=item['id'])[1] == item


def test_update_preserves_omitted_values_and_clears_explicit_nulls(api):
    _, body, _ = api.call('create_weather', dict(weather='Rainy', town='Buea',
                         temperatureC=0, humidityPct=100, latitude=0, longitude=0,
                         observedAt='2026-11-03T08:00:00Z'))
    item = body['item']
    _, updated, _ = api.call('update_weather', dict(weather='Sunny', town='Buea'), weather_id=item['id'])
    assert updated['temperatureC'] == 0
    assert updated['observedAt'] == item['observedAt']
    assert updated['createdAt'] == item['createdAt']
    status, updated, _ = api.call('update_weather', dict(weather='Sunny', town='Buea',
                                 temperatureC=None, latitude=None, longitude=None,
                                 observedAt=None), weather_id=item['id'])
    assert status == 200
    assert not {'temperatureC', 'latitude', 'longitude', 'observedAt'} & updated.keys()
    assert updated['humidityPct'] == 100


def test_import_provenance_and_manual_conversion(api):
    status, body, _ = api.call('create_weather', dict(weather='Rainy', town='Buea',
                              source='imported', provider=' Example weather service '))
    assert status == 201
    item = body['item']
    assert item['provider'] == 'Example weather service'
    _, updated, _ = api.call('update_weather', dict(weather='Cold', town='Buea'), weather_id=item['id'])
    assert updated['source'] == 'imported'
    assert updated['provider'] == item['provider']
    _, updated, _ = api.call('update_weather', dict(weather='Cold', town='Buea', source='manual'), weather_id=item['id'])
    assert updated['source'] == 'manual'
    assert 'provider' not in updated


def test_legacy_rows_still_read_and_update(api):
    api.modules['create_weather'].table.put_item(Item={'id': 'legacy', 'town': 'Buea', 'weather': 'Rainy'})
    assert api.call('get_weather', weather_id='legacy')[0] == 200
    status, item, _ = api.call('update_weather', dict(weather='Sunny', town='Buea'), weather_id='legacy')
    assert status == 200
    assert item['weather'] == 'Sunny'
    assert 'temperatureC' not in item
