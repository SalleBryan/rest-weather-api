"""Bounded, indexed list, town/date history and location-prefix queries."""
import base64
import binascii
import json
import os

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from api_response import respond
from search_index import FEED_INDEX, TOWN_INDEX, public_item, timestamp, town_key

table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])

def token(key, scope):
    return base64.urlsafe_b64encode(json.dumps(dict(v=1,key=key,scope=scope),separators=(',',':')).encode()).decode().rstrip('=')

def lambda_handler(event, context):
    params = event.get('queryStringParameters') or {}
    locations = (event.get('resource') or event.get('path','')).rstrip('/').endswith('/locations')
    try:
        limit = int(params.get('limit','20'))
        if not 1 <= limit <= 100:
            raise ValueError('limit must be between 1 and 100')
        town = town_key(params.get('town',''))
        q = town_key(params.get('q',''))
        if len(params.get('town',''))>60 or len(params.get('q',''))>60:
            raise ValueError('Location search must be at most 60 characters')
        start = timestamp(params['from']) if params.get('from') else ''
        end = timestamp(params['to']) if params.get('to') else ''
        if start and end and start >= end:
            raise ValueError('from must be before to')
        partition = 'feedKey' if locations or not town else 'townKey'
        value = 'LOCATIONS' if locations else town or 'READINGS'
        index = FEED_INDEX if partition=='feedKey' else TOWN_INDEX
        condition = Key(partition).eq(value)
        if locations:
            if q: condition &= Key('orderKey').begins_with(q)
        elif start and end:
            condition &= Key('orderKey').between(start, end)
        elif start:
            condition &= Key('orderKey').gte(start)
        elif end:
            condition &= Key('orderKey').lt(end)
        scope = dict(index=index,partition=value,q=q if locations else '',start=start,end=end)
        kwargs = dict(IndexName=index,KeyConditionExpression=condition,Limit=limit,ScanIndexForward=locations)
        if params.get('cursor'):
            encoded = params['cursor']
            if len(encoded)>4096: raise ValueError('Invalid cursor')
            decoded=json.loads(base64.b64decode(encoded+'='*(-len(encoded)%4),altchars=b'-_',validate=True))
            expected = {'id',partition,'orderKey'}
            # TownIndex also carries the base table id, but no FeedIndex keys.
            key = decoded.get('key',{})
            if decoded.get('v')!=1 or decoded.get('scope')!=scope or set(key)!=expected or key.get(partition)!=value or not all(isinstance(v,str) and 0<len(v)<=1024 for v in key.values()):
                raise ValueError('Cursor does not match this query')
            kwargs['ExclusiveStartKey']=key
    except (ValueError,TypeError,AttributeError,OverflowError,binascii.Error,UnicodeError) as error:
        return respond(400,dict(message=str(error) or 'Invalid query parameters'))
    try:
        result = table.query(**kwargs)
    except ClientError as error:
        if error.response['Error']['Code']=='ValidationException':
            return respond(400,dict(message='Invalid query or pagination cursor'))
        print('Weather query failed:',error.response['Error']['Code'])
        return respond(500,dict(message='Unable to load weather'))
    rows = [dict(town=item['town']) for item in result.get('Items',[])] if locations else [public_item(item) for item in result.get('Items',[])]
    key = result.get('LastEvaluatedKey')
    return respond(200,dict(items=rows,nextCursor=token(key,scope) if key else None))
