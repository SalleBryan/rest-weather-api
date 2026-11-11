import { Stack, StackProps } from "aws-cdk-lib";
import { BuildEnvironmentVariableType, BuildSpec, LinuxBuildImage } from "aws-cdk-lib/aws-codebuild";
import { ExecutionMode, Pipeline, PipelineType } from "aws-cdk-lib/aws-codepipeline";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { CodeBuildStep, CodePipeline, CodePipelineSource, ManualApprovalStep } from "aws-cdk-lib/pipelines";
import { Construct } from "constructs";
import { WeatherStage } from "./weather-stage";

export interface WeatherPipelineProps extends StackProps {
  repository: string;
  branch: string;
  connectionArn: string;
}

export class WeatherPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: WeatherPipelineProps) {
    super(scope, id, props);

    const source = CodePipelineSource.connection(props.repository, props.branch, {
      connectionArn: props.connectionArn,
    });
    const pipeline = new CodePipeline(this, "Pipeline", {
      codePipeline: new Pipeline(this, "Workflow", {
        pipelineType: PipelineType.V2,
        executionMode: ExecutionMode.QUEUED,
        restartExecutionOnUpdate: true,
      }),
      codeBuildDefaults: {
        buildEnvironment: { buildImage: LinuxBuildImage.AMAZON_LINUX_2023_5 },
      },
      // Deploy nested SAM stacks with CREATE_UPDATE and CAPABILITY_AUTO_EXPAND.
      useChangeSets: false,
      synth: new CodeBuildStep("TestAndSynth", {
        input: source,
        partialBuildSpec: BuildSpec.fromObject({
          phases: { install: { "runtime-versions": { nodejs: 24, python: "3.14" } } },
        }),
        env: {
          WEATHER_CONNECTION_ARN: props.connectionArn,
          WEATHER_REPOSITORY: props.repository,
          WEATHER_BRANCH: props.branch,
        },
        installCommands: [
          "python -m pip install uv==0.11.31",
          "uv sync --locked --python 3.14",
          "npm --prefix pipeline ci",
        ],
        commands: [
          "uv run --locked pytest",
          "node --test tests/*.test.cjs",
          "cd pipeline",
          "npm test",
          "uv run --locked cfn-lint -t ../template.yaml .build/weather-api.yaml",
          "npx --no-install cdk synth",
        ],
        primaryOutputDirectory: "pipeline/cdk.out",
      }),
    });

    const devSecret = Secret.fromSecretNameV2(this, "DevOwner", "rest-weather-api/dev-owner");
    const smokeRole = new Role(this, "SmokeTestRole", {
      assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
    });
    devSecret.grantRead(smokeRole);
    const dev = new WeatherStage(this, "Dev", {
      env: props.env,
      apiStageName: "dev",
      ownerSecretName: devSecret.secretName,
    });
    pipeline.addStage(dev, {
      post: [
        new CodeBuildStep("SmokeTest", {
          input: source,
          role: smokeRole,
          envFromCfnOutputs: { WEATHER_API_URL: dev.apiUrl },
          buildEnvironment: {
            environmentVariables: {
              WEATHER_API_TOKEN: {
                type: BuildEnvironmentVariableType.SECRETS_MANAGER,
                value: `${devSecret.secretName}:token`,
              },
            },
          },
          commands: ['python3 scripts/smoke_test.py "$WEATHER_API_URL"'],
        }),
      ],
    });

    pipeline.addStage(new WeatherStage(this, "Prod", {
      env: props.env,
      apiStageName: "prod",
      ownerSecretName: "rest-weather-api/prod-owner",
    }), {
      pre: [new ManualApprovalStep("ApproveProduction", {
        comment: "Review the Dev smoke test and this commit before deploying to production.",
      })],
    });
  }
}
