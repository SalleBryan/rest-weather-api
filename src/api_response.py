"""Small helpers shared by every handler: building HTTP responses and reading the request body."""
import json
import math
from datetime import datetime, timezone
from decimal import Decimal, DecimalException

from boto3.dynamodb.types import DYNAMODB_CONTEXT

# CORS headers so a browser front-end (web/index.html) is allowed to read our responses.
HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

MAX_FIELD_LENGTH = 60
MEASUREMENTS = {
    'temperatureC': (-100, 70),
    'humidityPct': (0, 100),
    'windKph': (0, 500),
    'latitude': (-90, 90),
    'longitude': (-180, 180),
}


def json_value(value):
    """DynamoDB decimals are JSON numbers, not numeric strings."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f'Unsupported JSON value: {type(value).__name__}')


def respond(status_code, body):
    """Shape a Lambda result the way API Gateway expects it."""
    return {
        'statusCode': status_code,
        'headers': HEADERS,
        'body': json.dumps(body, default=json_value, allow_nan=False),
    }


def get_path_id(event):
    """Return the {id} from the URL path, or None if it is missing."""
    path_parameters = event.get('pathParameters') or {}
    return path_parameters.get('id')


def parse_weather_body(event):
    """Read {"weather": ..., "town": ...} from the request body.

    Returns (data, None) when the body is valid, or (None, error_message) when it isn't,
    so the handler can answer 400 instead of crashing.
    """
    raw_body = event.get('body')
    if not raw_body:
        return None, 'Request body is required, e.g. {"weather": "Cold", "town": "Douala"}'

    try:
        body = json.loads(raw_body)
    except json.JSONDecodeError:
        return None, 'Request body must be valid JSON'

    if not isinstance(body, dict):
        return None, 'Request body must be a JSON object'

    data = {}
    for field in ('weather', 'town'):
        value = body.get(field)
        if not isinstance(value, str) or not value.strip():
            return None, f"'{field}' is required and must be a non-empty string"
        if len(value.strip()) > MAX_FIELD_LENGTH:
            return None, f"'{field}' must be at most {MAX_FIELD_LENGTH} characters"
        data[field] = value.strip()

    for field, (low, high) in MEASUREMENTS.items():
        if field not in body:
            continue
        value = body[field]
        if value is None:
            data[field] = None
        elif isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= value <= high or not math.isfinite(value):
            return None, f"'{field}' must be a number between {low} and {high}, or null"
        else:
            try:
                data[field] = DYNAMODB_CONTEXT.copy().create_decimal(str(value))
            except DecimalException:
                return None, f"'{field}' exceeds supported numeric precision"

    if ('latitude' in body) != ('longitude' in body) or (body.get('latitude') is None) != (body.get('longitude') is None):
        return None, 'Provide latitude and longitude together, or clear both with null'

    if 'observedAt' in body:
        value = body['observedAt']
        if value is None:
            data['observedAt'] = None
        else:
            try:
                stamp = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else None
                if stamp is None or stamp.tzinfo is None:
                    raise ValueError()
                data['observedAt'] = stamp.astimezone(timezone.utc).isoformat(timespec='seconds')
            except (ValueError, OverflowError):
                return None, "'observedAt' must be an ISO 8601 timestamp with a timezone, or null"

    if 'source' in body:
        if body['source'] not in ('manual', 'imported'):
            return None, "'source' must be manual or imported"
        data['source'] = body['source']
        if body['source'] == 'manual':
            data['provider'] = None
        else:
            provider = body.get('provider')
            if not isinstance(provider, str) or not provider.strip() or len(provider.strip()) > 60:
                return None, 'Imported readings require a provider name of at most 60 characters'
            data['provider'] = provider.strip()
    elif 'provider' in body:
        return None, 'Provide source with provider'

    return data, None
