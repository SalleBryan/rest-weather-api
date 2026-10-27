import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from api_response import get_path_id, parse_weather_body, respond

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get("TABLE_NAME")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    print(f"event {event}")
    weather_id = get_path_id(event)
    if not weather_id:
        return respond(400, {"message": "Weather id is required in the path: /weather/{id}"})

    data, error = parse_weather_body(event)
    if error:
        return respond(400, {"message": error})

    print(f"weather_id {weather_id} -> {data}")

    try:
        response = table.update_item(
            Key={
                'id': weather_id
            },
            UpdateExpression="set #weather = :weather, #town = :town, #updatedAt = :updatedAt",
            # update_item creates the item if it doesn't exist (an "upsert").
            # This condition makes it update existing items only.
            ConditionExpression="attribute_exists(id)",
            ExpressionAttributeNames={
                "#weather": "weather",
                "#town": "town",
                "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues={
                ":weather": data['weather'],
                ":town": data['town'],
                ":updatedAt": datetime.now(timezone.utc).isoformat(timespec='seconds'),
            },
            ReturnValues="ALL_NEW"
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return respond(404, {"message": f"Weather item {weather_id} not found"})
        print(e)
        return respond(500, {"message": "Something went wrong"})

    return respond(200, response['Attributes'])
