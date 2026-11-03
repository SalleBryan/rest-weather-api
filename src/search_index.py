"""Index keys and public response shaping. Location catalog entries are not readings."""
import unicodedata
from datetime import datetime, timezone

FEED_INDEX = 'FeedIndex'
TOWN_INDEX = 'TownIndex'
ATTRIBUTES = [dict(AttributeName=k, AttributeType='S') for k in ('id','feedKey','townKey','orderKey')]
INDEXES = [dict(IndexName=name, KeySchema=[dict(AttributeName=key,KeyType='HASH'),dict(AttributeName='orderKey',KeyType='RANGE')], Projection=dict(ProjectionType='ALL')) for name,key in [(FEED_INDEX,'feedKey'),(TOWN_INDEX,'townKey')]]

def town_key(name):
    return ' '.join(unicodedata.normalize('NFKC', name).strip().lower().split())

def timestamp(value):
    if not isinstance(value,str):
        raise ValueError('Expected an ISO timestamp with a timezone')
    parsed = datetime.fromisoformat(value.replace('Z','+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timestamp needs a timezone')
    return parsed.astimezone(timezone.utc).isoformat(timespec='microseconds')

def index_fields(item):
    try:
        date = timestamp(item.get('observedAt') or item.get('createdAt'))
    except (ValueError,TypeError,OverflowError):
        date = '1970-01-01T00:00:00.000000+00:00'
    return dict(feedKey='READINGS', townKey=town_key(item['town']), orderKey=date+'#'+item['id'])

def catalog(table, town):
    key = town_key(town)
    table.put_item(Item=dict(id='location#'+key, feedKey='LOCATIONS', orderKey=key, town=town.strip()))

def public_item(item):
    return {k:v for k,v in item.items() if k not in ('feedKey','townKey','orderKey','revision')}
