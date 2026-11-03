import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from search_index import index_fields, catalog, public_item

from api_response import parse_weather_body, respond

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get("TABLE_NAME")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    print(f"event is {event}")
    print(f"table name is {table_name}")

    data, error = parse_weather_body(event)
    if error:
        return respond(400, {"message": error})

    now = datetime.now(timezone.utc).isoformat(timespec='seconds')
    item = {
        # uuid4 instead of a random 3-digit number: 899 possible ids gives a ~50% chance
        # of two items colliding (and one silently overwriting the other) after just 36 items.
        'id': str(uuid.uuid4()),
        **{key: value for key, value in data.items() if value is not None},
        'source': data.get('source', 'manual'),
        'createdAt': now,
        'updatedAt': now,
    }

    item.update(index_fields(item))
    item["revision"] = str(uuid.uuid4())
    try:
        catalog(table, item["town"])
        # The condition guarantees a create can never replace an existing item.
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(id)')
    except ClientError as e:
        print(f"put_item failed: {e}")
        return respond(500, {"message": "Could not create the weather item"})

    return respond(201, {"message": "Weather successfully created!", "item": public_item(item)})
