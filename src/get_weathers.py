import os

import boto3
from botocore.exceptions import ClientError

from api_response import respond

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get("TABLE_NAME")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    items = []
    scan_kwargs = {}

    try:
        # A single scan returns at most 1 MB of data. LastEvaluatedKey tells us
        # there is more, so keep scanning from where the last page stopped.
        while True:
            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break
            scan_kwargs['ExclusiveStartKey'] = last_key
    except ClientError as e:
        print(f"scan failed: {e}")
        return respond(500, {"message": "Unable to get weather"})

    # Newest first, so the latest reading is always at the top.
    items.sort(key=lambda item: item.get('createdAt', ''), reverse=True)
    return respond(200, items)
