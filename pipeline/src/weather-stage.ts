import { resolve } from "node:path";
import { CfnOutput, CfnStack, SecretValue, Stack, Stage, StageProps } from "aws-cdk-lib";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { Construct } from "constructs";

export interface WeatherStageProps extends StageProps {
  apiStageName: "dev" | "prod";
  ownerSecretName: string;
}

export class WeatherStage extends Stage {
  readonly apiUrl: CfnOutput;

  constructor(scope: Construct, id: string, props: WeatherStageProps) {
    super(scope, id, props);

    const stack = new Stack(this, "WeatherApi");
    const code = new Asset(stack, "LambdaCode", {
      path: resolve(__dirname, "../../src"),
      exclude: ["**/__pycache__/**", "**/*.pyc"],
    });
    const template = new Asset(stack, "SamTemplate", {
      path: resolve(__dirname, "../.build/weather-api.yaml"),
    });

    const api = new CfnStack(stack, "Api", {
      templateUrl: template.httpUrl,
      parameters: {
        ApiStageName: props.apiStageName,
        LambdaCodeBucket: code.s3BucketName,
        LambdaCodeKey: code.s3ObjectKey,
        // CloudFormation resolves the digest when it sends this NoEcho SAM parameter.
        OwnerTokenSha256: SecretValue.secretsManager(props.ownerSecretName, {
          jsonField: "sha256",
        }).unsafeUnwrap(),
      },
    });

    this.apiUrl = new CfnOutput(stack, "WeatherApiUrl", {
      value: api.getAtt("Outputs.WeatherApiUrl").toString(),
    });
  }
}
