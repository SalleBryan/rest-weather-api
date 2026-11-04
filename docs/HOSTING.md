# Amplify hosting, security, and cost

Production: [Weather Board](https://main.d3u6uhv5z1v0j6.amplifyapp.com/), us-east-1, static WEB app. The `main` branch is a manual deployment with automatic builds, branch creation, previews, performance mode, and SSR disabled. No repository OAuth token, build IAM role, server runtime, analytics service, paid map SDK, custom domain, or Amplify WAF integration is required. Existing unrelated apps remain untouched.

## US$3 monthly safety budget

`WeatherBoard-3USD-account-safety` alerts established account billing email destinations at actual costs above 50%, 80%, and 100%, and forecast costs above 100%. It excludes credits and refunds from the calculation so credits do not hide underlying charges. No paid budget action is configured.

This is deliberately **account-wide**, including other projects. Cost-allocation tags were inactive at setup. An apparently project-specific tag filter could otherwise report no spend while charges were occurring. Resources for this project are tagged `Project=WeatherBoard` where supported. Once the billing tag becomes available and is activated, a project budget can supplement this conservative guard; it should not silently replace it before tagged cost coverage is verified. Email destinations and credentials are kept outside the repository.

**Alerts can be delayed and are not a spending cap.** Hosting bandwidth, API Gateway requests (including rejected requests), Lambda, DynamoDB/index storage, logs, and deployment artifact storage can incur charges. Static hosting avoids SSR/build compute but cannot guarantee a bill below US$3 under arbitrary traffic. Free-tier credits and account eligibility are not assumed. No security service with a fixed fee above this budget is enabled.

[Amplify pricing](https://aws.amazon.com/amplify/pricing/) lists transfer/storage/build charges and a separate per-app WAF integration fee. [AWS budget guidance](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) describes billing monitoring; do not treat a notification as an immediate shutoff.

## Request controls and credentials

- Open-Meteo free non-commercial forecast/geocoding hosts are fixed in Weather. At most ten requested variables, seven days, one location per forecast. Browser limits: ten requests/minute and 100/UTC day, shared across these hosts. Searches debounce after three characters; forecasts cache for 15 minutes, search results for 24 hours. No polling, automatic retries, or automatic requests for all favorites. Compare refreshes at most three places intentionally.
- The BYO journal has a separate browser allowance. Only an explicit Connect sends requests. A token remains in tab memory; it is cleared on disconnect/reload. Requests omit cookies, reject redirects, bypass the HTTP cache, and never enter the service-worker cache. Browser limits are bypassable convenience controls, not authentication or account-wide provider quotas.
- The deployed journal requires `Authorization: Bearer <owner-token>`. A TOKEN authorizer checks a 256-bit random credential against a SHA256 digest, compares in constant time, and caches the authorized policy for five minutes across this API/stage's routes. Missing or wrong credentials are denied. CORS preflight remains public. This is single-owner access, not multi-tenant login.
- API stage traffic is best-effort one request/second with burst three. Limits do not guarantee spending protection. Lambda roles remain scoped through SAM Connectors; the authorizer has no table permissions. Seven-day Lambda log retention bounds log storage. Full request event logging was removed to avoid recording bearer headers.
- The private owner token is provisioned outside the repository and public artifact. Never paste it into Git, a URL, a screenshot, or a Postman export. For smoke tests, set `WEATHER_API_TOKEN` only in the process environment. The collection has an empty private `ownerToken` variable.

For a new deployment, generate a cryptographically random base64url token with at least 32 random bytes. Deploy its lowercase SHA256 digest as the NoEcho SAM parameter `OwnerTokenSha256`, and retain the original token privately. To revoke a token, replace the digest and flush the API authorizer cache (or wait five minutes). Do not store the raw token in SAM configuration.

## Browser and offline security

`web/customHttp.yml` supplies CSP, HSTS, frame denial, MIME protection, a no-referrer policy, and restricted browser permissions. Scripts/fonts/workers are same-origin. Weather connections are limited to the two provider hosts; Your API allows HTTPS endpoints because the owner chooses their compatible API. Inline style declarations support runtime Material color roles; inline scripts and remote scripts are blocked. CORS is not used as an authentication mechanism.

The service worker contains an explicit static-asset allowlist. It never intercepts cross-origin or authenticated requests. A versioned shell updates after old app tabs close. Last forecast snapshots are separate, bounded local storage with fetch time and a stale label after 15 minutes. Clearing local weather removes provider caches and place data while retaining request counters. Journal responses and owner credentials are not saved offline. Closing the app is not a request to erase browser-local forecasts.

## Reproduce a manual release

```powershell
uv run python scripts/package_web.py C:/path/outside/repo/weather-board.zip
```

Use Amplify `create-deployment` for the app's `main` branch, upload that ZIP to its presigned URL, and call `start-deployment`. Only archive contents belong at the root. `customHttp.yml` is included for manual deployments; the app also has the same custom headers. Review the job result and test HTTPS headers, navigation, weather search, offline reload, and API preflight before sharing. Do not upload the project root, private credential folder, tests, source research extracts, or `.venv`.

Increment the service-worker version whenever runtime assets change. Keep HTML revalidated and the worker uncached; locally served fonts have bounded long-lived caching. No SPA catch-all rewrites are needed: the two actual HTML pages and hash destinations work directly.

Primary deployment references: [manual deployment](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html), [custom headers](https://docs.aws.amazon.com/amplify/latest/userguide/setting-custom-headers.html), [security practices](https://docs.aws.amazon.com/amplify/latest/userguide/security-best-practices.html), and [Lambda authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html).
