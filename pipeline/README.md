# Weather API delivery pipeline

The pipeline watches a GitHub branch. CodeBuild runs pytest for the Python Lambda handlers, Node's test runner for the dashboard, Jest for the infrastructure, and cfn-lint for the SAM templates. CDK synthesizes the CloudFormation templates and stages the API source as an S3 asset. The pipeline updates its own definition if it changed, publishes the assets, deploys Dev, and runs the existing CRUDL HTTP smoke test. Prod waits for manual approval and uses the same revision and assets as Dev.

Both environments use `../template.yaml` and `../src/`. The build prepares a copy of the SAM template with S3 code parameters and a stage-specific URL. It lets CloudFormation generate unique Lambda names so the two environments can coexist with the standalone SAM stack. The pipeline packages Python sources directly because the handlers use the SDK provided by Lambda. The build checks for new requirements so they cannot be silently left out of a release.

## Run locally

From the repository root, with Node.js 24, Python 3.14 and uv installed:

```powershell
uv sync --locked --python 3.14
uv run --locked pytest
node --test tests/*.test.cjs
npm ci --prefix pipeline
npm test --prefix pipeline
uv run --locked cfn-lint -t template.yaml pipeline/.build/weather-api.yaml
```

Use a dummy ARN for local synthesis. This produces the templates and asset manifests in `pipeline/cdk.out/`.

```powershell
$env:WEATHER_CONNECTION_ARN = 'arn:aws:codeconnections:us-east-1:111111111111:connection/00000000-0000-0000-0000-000000000000'
npm run synth --prefix pipeline -- --quiet
```

## Set up the first AWS run

1. Create or select an **Available** AWS CodeConnections connection for GitHub and give it access to the repository. Use its ARN as `WEATHER_CONNECTION_ARN`. The pipeline and both API stages use the AWS account and Region from that ARN.
2. In that Region, use Secrets Manager with its default encryption key. Create `rest-weather-api/dev-owner` with JSON fields `token` and `sha256`. The first field is a private random base64url token with at least 32 bytes of randomness. The second is its lowercase SHA-256 digest. Create `rest-weather-api/prod-owner` with a separate credential and its digest under `sha256`. Retain the Prod token privately. CloudFormation reads the digests at deployment time. Only the Dev smoke project reads a raw token.
3. Publish the reviewed code, including `pipeline/package-lock.json`, to the branch the connection should watch. It defaults to `main` in `SalleBryan/rest-weather-api`. Set `WEATHER_REPOSITORY` and `WEATHER_BRANCH` if using a fork or a dedicated branch. Restrict who can update that branch because the pipeline runs its build commands and can update itself.
4. From `pipeline/`, bootstrap the target CDK environment if needed, compile the CDK app and deploy the pipeline once. Use an AWS CLI profile authorized for the target account. The AWS CLI's account and Region should match the connection ARN.

```powershell
Set-Location pipeline
$env:WEATHER_CONNECTION_ARN = '<your available GitHub connection ARN>'
npx cdk bootstrap 'aws://<account-id>/<region>' --profile '<profile>'
npm run build
npx cdk deploy RestWeatherDeliveryPipeline --profile '<profile>'
```

In AWS CodePipeline, open the execution and inspect **Build**, then **Dev → SmokeTest**. The smoke test uses the Dev stack's `WeatherApiUrl` output and its credential from Secrets Manager. It creates, reads, updates, lists and deletes a test reading. Approve **Prod** after reviewing the commit and the Dev results. Find each stage's URL in its CloudFormation stack outputs and use the matching token for HTTP requests. The Dev and Prod stages provision separate APIs and tables for this pipeline. The existing Amplify frontend is deployed separately.
