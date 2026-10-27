import os

import boto3
from botocore.exceptions import ClientError

from api_response import get_path_id, respond

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get("TABLE_NAME")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    weather_id = get_path_id(event)
    print(f"weather id {weather_id} is being deleted")
    if not weather_id:
        return respond(400, {"message": "Weather id is required in the path: /weather/{id}"})

    try:
        # delete_item succeeds even when the key doesn't exist, so the condition
        # is what lets us tell the caller "that item was never there".
        response = table.delete_item(
            Key={"id": weather_id},
            ConditionExpression="attribute_exists(id)",
            ReturnValues="ALL_OLD",
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return respond(404, {"message": f"Weather item {weather_id} not found"})
        print(e)
        return respond(500, {"message": "Weather item not deleted successfully"})

    return respond(200, {"message": "Weather item deleted successfully", "item": response.get('Attributes')})
