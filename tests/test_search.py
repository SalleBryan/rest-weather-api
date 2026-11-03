import pytest
from search_index import index_fields


def test_location_prefix_catalog_is_distinct_and_bounded(api):
    for town in [' Buea ', 'BUEA', 'Buea', 'Bamenda', 'Douala']:
        api.create(town=town)
    status, result, _ = api.call('get_weathers', path='/locations', query={'q':'b','limit':'1'})
    assert status == 200 and len(result['items']) == 1
    assert result['nextCursor']
    _, page, _ = api.call('get_weathers', path='/locations', query={'q':'b','limit':'1','cursor':result['nextCursor']})
    assert {result['items'][0]['town'].lower(),page['items'][0]['town'].lower()} == {'bamenda','buea'}
    # Catalog metadata cannot be read or deleted as a reading.
    assert api.call('get_weather', weather_id='location#buea')[0] == 404
    assert api.call('delete_weather', weather_id='location#buea')[0] == 404


def test_town_date_queries_use_observation_time_and_exclusive_upper_bound(api):
    for day in [1,2,3]:
        api.call('create_weather', {'town':'Buea','weather':'Rainy','observedAt':f'2026-11-0{day}T08:00:00Z'})
    api.create(town='Douala')
    status, page, _ = api.call('get_weathers',query={'town':'  BUEA ', 'from':'2026-11-01T08:00:00Z','to':'2026-11-03T08:00:00Z'})
    assert status == 200
    assert len(page['items']) == 2
    assert page['items'][0]['observedAt'].startswith('2026-11-02')
    assert all('townKey' not in item for item in page['items'])


def test_cursor_is_bound_to_query_and_invalid_tokens_are_400(api):
    for n in range(3): api.create(town='Buea')
    _, page, _ = api.call('get_weathers', query={'town':'Buea','limit':'1'})
    token = page['nextCursor']
    for query in [{'town':'Douala','cursor':token}, {'cursor':token}, {'cursor':'!broken!'}, {'cursor':'bnVsbA'}]:
        assert api.call('get_weathers', query=query)[0] == 400


@pytest.mark.parametrize('query', [{'limit':'0'}, {'limit':'101'}, {'limit':'x'}, {'from':'2026-11-03'}, {'from':'2026-11-03T00:00:00Z','to':'2026-11-02T00:00:00Z'}])
def test_bad_query_rejected(api,query):
    assert api.call('get_weathers',query=query)[0] == 400


def test_town_rename_and_observation_edit_move_the_index_entry(api):
    item = api.create(town='Buea')
    status, _, _ = api.call('update_weather', {'town':'Douala','weather':'HOT','observedAt':'2026-11-01T00:00:00Z'},weather_id=item['id'])
    assert status == 200
    assert api.call('get_weathers',query={'town':'Buea'})[1]['items'] == []
    page = api.call('get_weathers',query={'town':'Douala'})[1]
    assert page['items'][0]['id'] == item['id']
    assert page['items'][0]['observedAt'].startswith('2026-11-01')


def test_concurrent_edit_is_rejected_without_overwriting(api,monkeypatch):
    item = api.create()
    table = api.modules['update_weather'].table
    original = table.update_item
    def raced(**kwargs):
        original(Key={'id':item['id']},UpdateExpression='SET revision=:v',ExpressionAttributeValues={':v':'newer'})
        return original(**kwargs)
    monkeypatch.setattr(table,'update_item',raced)
    assert api.call('update_weather',{'town':'Douala','weather':'HOT'},weather_id=item['id'])[0] == 409
    assert api.call('get_weather',weather_id=item['id'])[1]['weather'] == 'Cold'


def test_unicode_normalization_does_not_reject_an_existing_town(api):
    name = '\u0130' * 60
    item = api.create(town=name)
    status, page, _ = api.call('get_weathers',query={'town':name})
    assert status == 200
    assert page['items'][0]['id'] == item['id']
