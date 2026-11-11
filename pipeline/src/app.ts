import { App } from "aws-cdk-lib";
import { WeatherPipelineStack } from "./pipeline-stack";

const connectionArn = process.env.WEATHER_CONNECTION_ARN;
const connection = connectionArn?.match(
  /^arn:aws(?:-[a-z]+)*:(?:codeconnections|codestar-connections):([a-z0-9-]+):(\d{12}):connection\/[a-f0-9-]{36}$/i,
);
if (!connection || !connectionArn) {
  throw new Error("Set WEATHER_CONNECTION_ARN to the GitHub CodeConnections connection ARN.");
}

new WeatherPipelineStack(new App(), "RestWeatherDeliveryPipeline", {
  env: { account: connection[2], region: connection[1] },
  repository: process.env.WEATHER_REPOSITORY ?? "SalleBryan/rest-weather-api",
  branch: process.env.WEATHER_BRANCH ?? "main",
  connectionArn,
});
