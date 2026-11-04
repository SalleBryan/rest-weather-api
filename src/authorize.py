"""Single-owner bearer authorization. Never log tokens or request events."""
import hashlib
import hmac
import os
import re


def lambda_handler(event, context):
    token = event.get('authorizationToken', '')
    expected = os.environ.get('OWNER_TOKEN_SHA256', '')
    if not re.fullmatch(r'Bearer [A-Za-z0-9_-]{43,128}', token) or not re.fullmatch(r'[a-f0-9]{64}', expected):
        raise Exception('Unauthorized')
    digest = hashlib.sha256(token[7:].encode()).hexdigest()
    if not hmac.compare_digest(digest, expected):
        raise Exception('Unauthorized')
    # TOKEN authorizer cache is shared across routes. Cover this API/stage only.
    arn = event.get('methodArn', '')
    if not re.fullmatch(r'arn:aws:execute-api:[a-z0-9-]+:\d{12}:[a-z0-9]+/[a-zA-Z0-9_-]+/.*', arn):
        raise Exception('Unauthorized')
    resource = '/'.join(arn.split('/')[:2]) + '/*/*'
    return {'principalId': 'owner', 'policyDocument': {'Version': '2012-10-17', 'Statement': [{'Action': 'execute-api:Invoke', 'Effect': 'Allow', 'Resource': resource}]}}
