"""Run the five Lambda handlers on http://localhost:3000 with an in-memory DynamoDB.

No AWS account, no Docker: moto fakes DynamoDB, and a tiny HTTP server plays the role of
API Gateway (same routes as template.yaml). Handy for the dashboard, Postman and the smoke test.

    uv run python scripts/local_api.py            # then open web/index.html
    uv run python scripts/local_api.py --port 8080

Data lives in memory and disappears when you stop the server (Ctrl+C).
"""
import argparse
import importlib
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'src'))

TABLE_NAME = 'WeatherTable-local'

# Mirrors the Events section of template.yaml: (method, path pattern) -> handler module
ROUTES = [
    ('POST', re.compile(r'^/create-weather$'), 'create_weather'),
    ('GET', re.compile(r'^/weathers$'), 'get_weathers'),
    ('GET', re.compile(r'^/weather/(?P<id>[^/]+)$'), 'get_weather'),
    ('PUT', re.compile(r'^/weather/(?P<id>[^/]+)$'), 'update_weather'),
    ('DELETE', re.compile(r'^/weather/(?P<id>[^/]+)$'), 'delete_weather'),
]

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def start_fake_aws():
    import boto3
    from moto import mock_aws

    os.environ.update({
        'TABLE_NAME': TABLE_NAME,
        'AWS_DEFAULT_REGION': 'us-east-2',
        'AWS_ACCESS_KEY_ID': 'local',
        'AWS_SECRET_ACCESS_KEY': 'local',
    })
    mock = mock_aws()
    mock.start()
    boto3.resource('dynamodb').create_table(
        TableName=TABLE_NAME,
        AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        BillingMode='PAY_PER_REQUEST',
    )
    return {name: importlib.import_module(name) for _, _, name in ROUTES}


class ApiGateway(BaseHTTPRequestHandler):
    handlers = {}
    stage = '/dev'

    def do_OPTIONS(self):
        self.send_response(204)
        for key, value in CORS.items():
            self.send_header(key, value)
        self.end_headers()

    def do_GET(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PUT(self):
        self.route()

    def do_DELETE(self):
        self.route()

    def route(self):
        path = self.path.split('?')[0]
        if path.startswith(self.stage):
            path = path[len(self.stage):] or '/'

        for method, pattern, name in ROUTES:
            match = pattern.match(path)
            if match and method == self.command:
                length = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(length).decode() if length else None
                event = {
                    'httpMethod': self.command,
                    'path': path,
                    'pathParameters': match.groupdict() or None,
                    'body': body,
                }
                result = self.handlers[name].lambda_handler(event, None)
                return self.reply(result['statusCode'], result['body'], result.get('headers', {}), name)

        # Same shape API Gateway uses for an unknown route
        self.reply(403, json.dumps({'message': 'Missing Authentication Token'}), CORS, '-')

    def reply(self, status, body, headers, handler_name):
        payload = body.encode()
        self.send_response(status)
        for key, value in {**CORS, **headers}.items():
            self.send_header(key, value)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('X-Lambda-Function', handler_name)
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print(f"  {self.command:<6} {self.path:<50} -> {args[1]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--port', type=int, default=3000)
    args = parser.parse_args()

    ApiGateway.handlers = start_fake_aws()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), ApiGateway)
    print(f"\nLocal weather API running at http://localhost:{args.port}/dev  (Ctrl+C to stop)")
    print("Routes: POST /create-weather | GET /weathers | GET, PUT, DELETE /weather/{id}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped. In-memory data discarded.")


if __name__ == '__main__':
    main()
