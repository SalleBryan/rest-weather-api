import hashlib
import pytest
from authorize import lambda_handler

TOKEN = 'a' * 43
ARN = 'arn:aws:execute-api:us-east-1:123456789012:abc123/dev/GET/weathers'


def test_owner_authorizes_every_route_in_same_stage(monkeypatch):
    monkeypatch.setenv('OWNER_TOKEN_SHA256', hashlib.sha256(TOKEN.encode()).hexdigest())
    result = lambda_handler({'authorizationToken': 'Bearer ' + TOKEN, 'methodArn': ARN}, None)
    assert result['policyDocument']['Statement'][0]['Resource'] == 'arn:aws:execute-api:us-east-1:123456789012:abc123/dev/*/*'


@pytest.mark.parametrize('token', ['', 'Bearer wrong', 'Bearer ' + 'b' * 43, 'bearer ' + TOKEN, 'Bearer ' + TOKEN + '\n'])
def test_missing_or_wrong_token_denied(monkeypatch, token, capsys):
    monkeypatch.setenv('OWNER_TOKEN_SHA256', hashlib.sha256(TOKEN.encode()).hexdigest())
    with pytest.raises(Exception, match='^Unauthorized$'):
        lambda_handler({'authorizationToken': token, 'methodArn': ARN}, None)
    assert capsys.readouterr().out == ''


def test_missing_configuration_fails_closed(monkeypatch):
    monkeypatch.delenv('OWNER_TOKEN_SHA256', raising=False)
    with pytest.raises(Exception, match='^Unauthorized$'):
        lambda_handler({'authorizationToken': 'Bearer ' + TOKEN, 'methodArn': ARN}, None)
