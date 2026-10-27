"""Small helpers shared by every handler: building HTTP responses and reading the request body."""
import json

# CORS headers so a browser front-end (web/index.html) is allowed to read our responses.
HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

MAX_FIELD_LENGTH = 60


def respond(status_code, body):
    """Shape a Lambda result the way API Gateway expects it."""
    return {
        'statusCode': status_code,
        'headers': HEADERS,
        'body': json.dumps(body, default=str),
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

    return data, None
