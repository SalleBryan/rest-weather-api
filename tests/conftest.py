import importlib
import json
import os

import boto3
import pytest
from moto import mock_aws

TABLE_NAME = 'WeatherTable-test'
HANDLERS = ['create_weather', 'get_weather', 'update_weather', 'delete_weather', 'get_weathers']


@pytest.fixture
def api():
    """A fake AWS account with an empty WeatherTable, plus the five handlers wired to it.

    The handlers create their DynamoDB table object at import time (just like in Lambda),
    so they are (re)imported inside the moto mock.
    """
    os.environ.update({
        'TABLE_NAME': TABLE_NAME,
        'AWS_DEFAULT_REGION': 'us-east-2',
        'AWS_ACCESS_KEY_ID': 'testing',
        'AWS_SECRET_ACCESS_KEY': 'testing',
    })
    with mock_aws():
        boto3.resource('dynamodb').create_table(
            TableName=TABLE_NAME,
            AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
            KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
            BillingMode='PAY_PER_REQUEST',
        )
        modules = {}
        for name in HANDLERS:
            module = importlib.import_module(name)
            modules[name] = importlib.reload(module)
        yield Api(modules)


class Api:
    """Calls a handler the way API Gateway would, and decodes the response."""

    def __init__(self, modules):
        self.modules = modules

    def call(self, handler, body=None, weather_id=None, raw_body=None):
        event = {
            'body': raw_body if raw_body is not None else (json.dumps(body) if body is not None else None),
            'pathParameters': {'id': weather_id} if weather_id else None,
        }
        result = self.modules[handler].lambda_handler(event, None)
        return result['statusCode'], json.loads(result['body']), result['headers']

    def create(self, weather='Cold', town='Douala'):
        status, body, _ = self.call('create_weather', {'weather': weather, 'town': town})
        assert status == 201
        return body['item']
