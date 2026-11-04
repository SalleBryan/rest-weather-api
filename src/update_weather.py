import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from search_index import index_fields, catalog, public_item

from api_response import get_path_id, parse_weather_body, respond

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get("TABLE_NAME")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    weather_id = get_path_id(event)
    if not weather_id:
        return respond(400, {"message": "Weather id is required in the path: /weather/{id}"})

    data, error = parse_weather_body(event)
    if error:
        return respond(400, {"message": error})


    try:
        existing = table.get_item(Key={'id':weather_id},ConsistentRead=True).get('Item')
    except ClientError:
        return respond(500, {'message':'Unable to read weather'})
    if not existing or 'weather' not in existing:
        return respond(404, {'message':f'Weather item {weather_id} not found'})
    data.update(index_fields({**existing,**data}))
    data['revision'] = str(uuid.uuid4())
    data['updatedAt'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    names, values, sets, removes = {}, {}, [], []
    for field, value in data.items():
        names[f'#{field}'] = field
        if value is None:
            removes.append(f'#{field}')
        else:
            values[f':{field}'] = value
            sets.append(f'#{field} = :{field}')
    expression = 'SET ' + ', '.join(sets)
    if removes:
        expression += ' REMOVE ' + ', '.join(removes)

    condition = 'attribute_exists(id) AND attribute_not_exists(revision)'
    if existing.get('revision'):
        condition = 'attribute_exists(id) AND revision = :expectedRevision'
        values[':expectedRevision'] = existing['revision']
    try:
        catalog(table, data['town'])
        response = table.update_item(
            Key={
                'id': weather_id
            },
            UpdateExpression=expression,
            # update_item creates the item if it doesn't exist (an "upsert").
            # This condition makes it update existing items only.
            ConditionExpression=condition,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW"
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return respond(409, {"message": "Reading changed or was deleted. Refresh before saving again."})
        print(e)
        return respond(500, {"message": "Something went wrong"})

    return respond(200, public_item(response['Attributes']))
