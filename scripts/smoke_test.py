"""End-to-end check of a deployed rest-weather-api.

Runs the full CRUDL cycle against the real API and prints one line per request:

    uv run python scripts/smoke_test.py https://abc123.execute-api.us-east-2.amazonaws.com/dev

Uses only the standard library, so it also runs with plain `python`.
"""
import json
import sys
import time
import urllib.error
import urllib.request

GREEN, RED, DIM, RESET = '\033[32m', '\033[31m', '\033[2m', '\033[0m'


def call(base_url, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(base_url + path, data=data, method=method,
                                     headers={'Content-Type': 'application/json'})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status, payload = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, payload = error.code, error.read()
    elapsed_ms = (time.perf_counter() - started) * 1000
    return status, json.loads(payload or b'null'), elapsed_ms


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    base_url = sys.argv[1].rstrip('/')

    failures = 0

    def check(label, method, path, expected, body=None):
        nonlocal failures
        status, payload, ms = call(base_url, method, path, body)
        ok = status == expected
        failures += not ok
        colour = GREEN if ok else RED
        print(f"{colour}{'PASS' if ok else 'FAIL'}{RESET}  {method:<6} {path:<52} "
              f"{colour}{status}{RESET} (want {expected})  {DIM}{ms:6.0f} ms  {label}{RESET}")
        return payload

    print(f"\nSmoke testing {base_url}\n")
    created = check('create', 'POST', '/create-weather', 201, {'weather': 'Cold', 'town': 'Douala'})
    weather_id = (created or {}).get('item', {}).get('id', 'missing-id')

    check('read', 'GET', f'/weather/{weather_id}', 200)
    check('update', 'PUT', f'/weather/{weather_id}', 200, {'weather': 'HOT', 'town': 'Douala'})
    items = check('list', 'GET', '/weathers', 200)
    check('delete', 'DELETE', f'/weather/{weather_id}', 200)
    check('read after delete', 'GET', f'/weather/{weather_id}', 404)
    check('update missing item', 'PUT', '/weather/does-not-exist', 404, {'weather': 'HOT', 'town': 'Buea'})
    check('delete missing item', 'DELETE', '/weather/does-not-exist', 404)
    check('create with bad body', 'POST', '/create-weather', 400, {'weather': 'Cold'})

    print(f"\n{len(items or [])} item(s) were in the table during the list call.")
    print(f"{GREEN}All checks passed.{RESET}\n" if not failures else f"{RED}{failures} check(s) failed.{RESET}\n")
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
