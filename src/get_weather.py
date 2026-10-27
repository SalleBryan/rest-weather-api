import os

import boto3
from botocore.exceptions import ClientError

from api_response import get_path_id, respond

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get("TABLE_NAME")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    weather_id = get_path_id(event)
    print(f"getting weather id {weather_id}")
    if not weather_id:
        return respond(400, {"message": "Weather id is required in the path: /weather/{id}"})

    try:
        response = table.get_item(Key={'id': weather_id})
    except ClientError as e:
        print(f"get_item failed: {e}")
        return respond(500, {"message": "Error getting weather"})

    # get_item returns no 'Item' key when nothing matches, so check before reading it.
    item = response.get('Item')
    if item is None:
        return respond(404, {"message": f"Weather item {weather_id} not found"})

    return respond(200, item)
