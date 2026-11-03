import math
from search_index import index_fields


# ── Create ──────────────────────────────────────────────────────────────────
def test_create_returns_201_and_the_new_item(api):
    status, body, headers = api.call('create_weather', {'weather': 'Cold', 'town': 'Douala'})

    assert status == 201
    assert body['message'] == 'Weather successfully created!'
    assert body['item']['weather'] == 'Cold'
    assert body['item']['town'] == 'Douala'
    assert len(body['item']['id']) == 36  # a uuid4
    assert headers['Access-Control-Allow-Origin'] == '*'


def test_create_never_reuses_an_id(api):
    ids = {api.create(town=f'Town {n}')['id'] for n in range(200)}
    assert len(ids) == 200


def test_create_trims_whitespace(api):
    item = api.create(weather='  Sunny ', town=' Buea  ')
    assert (item['weather'], item['town']) == ('Sunny', 'Buea')


def test_create_rejects_missing_body(api):
    status, body, _ = api.call('create_weather')
    assert status == 400
    assert 'required' in body['message']


def test_create_rejects_invalid_json(api):
    status, body, _ = api.call('create_weather', raw_body='{not json')
    assert status == 400
    assert 'valid JSON' in body['message']


def test_create_rejects_missing_or_empty_fields(api):
    for bad in ({'weather': 'Cold'}, {'town': 'Douala'}, {'weather': '', 'town': 'Douala'}, {'weather': 3, 'town': 'X'}):
        status, _, _ = api.call('create_weather', bad)
        assert status == 400, bad


def test_create_rejects_overlong_fields(api):
    status, _, _ = api.call('create_weather', {'weather': 'x' * 61, 'town': 'Douala'})
    assert status == 400


# ── Read ────────────────────────────────────────────────────────────────────
def test_get_returns_the_item(api):
    created = api.create()
    status, body, _ = api.call('get_weather', weather_id=created['id'])
    assert status == 200
    assert body == created


def test_get_missing_id_is_404_not_a_crash(api):
    status, body, _ = api.call('get_weather', weather_id='does-not-exist')
    assert status == 404
    assert 'not found' in body['message']


def test_get_without_path_id_is_400(api):
    status, _, _ = api.call('get_weather')
    assert status == 400


# ── Update ──────────────────────────────────────────────────────────────────
def test_update_changes_fields_and_keeps_created_at(api):
    created = api.create(weather='Cold', town='Douala')
    status, body, _ = api.call('update_weather', {'weather': 'HOT', 'town': 'Douala'}, weather_id=created['id'])

    assert status == 200
    assert body['weather'] == 'HOT'
    assert body['createdAt'] == created['createdAt']
    assert body['updatedAt'] >= created['updatedAt']


def test_update_missing_id_is_404_and_does_not_create(api):
    status, _, _ = api.call('update_weather', {'weather': 'HOT', 'town': 'Douala'}, weather_id='ghost')
    assert status == 404

    _, items, _ = api.call('get_weathers')
    assert items['items'] == []


def test_update_validates_body(api):
    created = api.create()
    status, _, _ = api.call('update_weather', {'weather': 'HOT'}, weather_id=created['id'])
    assert status == 400


# ── Delete ──────────────────────────────────────────────────────────────────
def test_delete_removes_the_item(api):
    created = api.create()
    status, body, _ = api.call('delete_weather', weather_id=created['id'])
    assert status == 200
    assert body['item']['id'] == created['id']

    status, _, _ = api.call('get_weather', weather_id=created['id'])
    assert status == 404


def test_delete_missing_id_is_404(api):
    status, _, _ = api.call('delete_weather', weather_id='ghost')
    assert status == 404


# ── List ────────────────────────────────────────────────────────────────────
def test_list_empty_table(api):
    status, items, _ = api.call('get_weathers')
    assert status == 200
    assert items['items'] == []


def test_list_returns_bounded_pages_without_scanning(api, monkeypatch):
    for n in range(25):
        api.create(town=f'Town {n}')
    table = api.modules['get_weathers'].table
    monkeypatch.setattr(table, 'scan', lambda **kwargs: (_ for _ in ()).throw(AssertionError('Runtime scan')))
    collected, cursor = [], None
    while True:
        query = {'limit':'7'}
        if cursor: query['cursor'] = cursor
        status, page, _ = api.call('get_weathers', query=query)
        assert status == 200
        assert len(page['items']) <= 7
        collected.extend(page['items'])
        cursor = page['nextCursor']
        if not cursor: break
    assert len({item['id'] for item in collected}) == 25


def test_list_is_newest_first(api):
    table = api.modules['create_weather'].table
    for n, stamp in enumerate(['2026-10-01T08:00:00+00:00', '2026-10-03T08:00:00+00:00', '2026-10-02T08:00:00+00:00']):
        item = {'id': str(n), 'weather': 'Cold', 'town': 'Buea', 'createdAt': stamp, 'updatedAt': stamp}
        table.put_item(Item={**item, **index_fields(item)})

    _, items, _ = api.call('get_weathers')
    assert [i['id'] for i in items['items']] == ['1', '2', '0']


# ── Why uuid4: the birthday-paradox maths behind the original 3-digit ids ──
def test_three_digit_ids_collide_about_half_the_time_by_36_items():
    possible_ids = len(range(100, 999))  # random.randrange(100, 999) -> 899 values
    p_no_collision = math.prod(1 - k / possible_ids for k in range(36))
    assert 0.48 < 1 - p_no_collision < 0.52
