const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { App } = require("aws-cdk-lib");
const { Template } = require("aws-cdk-lib/assertions");
const { parseDocument } = require("yaml");
const { WeatherPipelineStack } = require("../dist/pipeline-stack");

const connectionArn = "arn:aws:codeconnections:us-east-1:111111111111:connection/00000000-0000-0000-0000-000000000000";
const outdir = mkdtempSync(join(tmpdir(), "weather-pipeline-test-"));
const app = new App({ outdir });
const pipeline = new WeatherPipelineStack(app, "Delivery", {
  env: { account: "111111111111", region: "us-east-1" },
  repository: "example/rest-weather-api",
  branch: "main",
  connectionArn,
});

afterAll(() => rmSync(outdir, { recursive: true, force: true }));

test("the deployable SAM copy packages the existing API and avoids Lambda name collisions", () => {
  const sam = parseDocument(readFileSync(resolve(__dirname, "../.build/weather-api.yaml"), "utf8"));
  const { Resources, Globals } = sam.toJS();
  expect(sam.errors).toEqual([]);
  expect(Resources.WeatherTable).toMatchObject({
    Type: "AWS::DynamoDB::Table",
    Properties: { KeySchema: [{ AttributeName: "id", KeyType: "HASH" }] },
  });
  expect(Resources.WeatherApi).toMatchObject({
    Type: "AWS::Serverless::Api",
    Properties: {
      StageName: { Ref: "ApiStageName" },
      Auth: { DefaultAuthorizer: "OwnerAuthorizer" },
    },
  });
  expect(sam.getIn(["Globals", "Function", "Environment", "Variables", "TABLE_NAME"], true))
    .toMatchObject({ tag: "!Ref", value: "WeatherTable" });
  expect(Globals.Function.CodeUri).toEqual({
    Bucket: { Ref: "LambdaCodeBucket" },
    Key: { Ref: "LambdaCodeKey" },
  });

  const functions = Object.values(Resources).filter(resource => resource.Type === "AWS::Serverless::Function");
  expect(functions).toHaveLength(6); // Five CRUDL handlers and the authorizer.
  expect(functions.map(({ Properties }) => Properties.Handler).sort()).toEqual([
    "authorize.lambda_handler",
    "create_weather.lambda_handler",
    "delete_weather.lambda_handler",
    "get_weather.lambda_handler",
    "get_weathers.lambda_handler",
    "update_weather.lambda_handler",
  ]);
  for (const { Properties } of functions) expect(Properties.FunctionName).toBeUndefined();
});

test.each([["Dev", "dev"], ["Prod", "prod"]])("%s deploys its own API with its own credentials", (id, name) => {
  const stack = pipeline.node.findChild(id).node.findChild("WeatherApi");
  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::CloudFormation::Stack", 1);
  template.hasResourceProperties("AWS::CloudFormation::Stack", {
    Parameters: {
      ApiStageName: name,
      OwnerTokenSha256: `{{resolve:secretsmanager:rest-weather-api/${name}-owner:SecretString:sha256::}}`,
    },
  });
  template.hasOutput("WeatherApiUrl", {
    Value: { "Fn::GetAtt": ["Api", "Outputs.WeatherApiUrl"] },
  });
});

test("GitHub feeds one queued execution through testing, Dev smoke checks, and Prod approval", () => {
  const template = Template.fromStack(pipeline);
  const [workflow] = Object.values(template.findResources("AWS::CodePipeline::Pipeline"));
  expect(workflow.Properties).toMatchObject({ PipelineType: "V2", ExecutionMode: "QUEUED" });
  const stages = workflow.Properties.Stages;
  expect(stages.map(stage => stage.Name)).toEqual([
    "Source", "Build", "UpdatePipeline", "Assets", "Dev", "Prod",
  ]);
  const actions = name => stages.find(stage => stage.Name === name).Actions;
  expect(actions("Source")[0]).toMatchObject({
    ActionTypeId: { Provider: "CodeStarSourceConnection" },
    Configuration: { FullRepositoryId: "example/rest-weather-api", BranchName: "main", ConnectionArn: connectionArn },
  });
  const devDeploy = actions("Dev").find(action => action.ActionTypeId.Provider === "CloudFormation");
  const devSmoke = actions("Dev").find(action => action.ActionTypeId.Provider === "CodeBuild");
  expect(devDeploy.Configuration.ActionMode).toBe("CREATE_UPDATE");
  expect(devDeploy.Configuration.Capabilities).toContain("CAPABILITY_AUTO_EXPAND");
  expect(devSmoke.RunOrder).toBeGreaterThan(devDeploy.RunOrder);
  const approval = actions("Prod").find(action => action.ActionTypeId.Category === "Approval");
  const prodDeploy = actions("Prod").find(action => action.ActionTypeId.Provider === "CloudFormation");
  expect(prodDeploy.RunOrder).toBeGreaterThan(approval.RunOrder);
  expect(prodDeploy.Configuration.StackName).not.toBe(devDeploy.Configuration.StackName);
});
