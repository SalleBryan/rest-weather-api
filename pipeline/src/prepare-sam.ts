import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isMap, parseDocument } from "yaml";

const root = resolve(__dirname, "../..");
const requirements = readFileSync(resolve(root, "src/requirements.txt"), "utf8");
if (requirements.split(/\r?\n/).some(line => line.trim() && !line.trimStart().startsWith("#"))) {
  throw new Error("The pipeline packages Python sources directly. Add dependency bundling before adding Lambda requirements.");
}

// Work on a deployment copy so the existing standalone SAM stack keeps its resource IDs.
const template = parseDocument(readFileSync(resolve(root, "template.yaml"), "utf8"));
if (template.errors.length) throw template.errors[0];
const resources = template.get("Resources", true);
if (!isMap(resources)) throw new Error("The SAM template must define Resources");

template.setIn(["Parameters", "ApiStageName"], { Type: "String", AllowedValues: ["dev", "prod"] });
template.setIn(["Parameters", "LambdaCodeBucket"], { Type: "String" });
template.setIn(["Parameters", "LambdaCodeKey"], { Type: "String" });
template.setIn(["Globals", "Function", "CodeUri"], {
  Bucket: { Ref: "LambdaCodeBucket" },
  Key: { Ref: "LambdaCodeKey" },
});
template.setIn(["Resources", "WeatherApi", "Properties", "StageName"], { Ref: "ApiStageName" });
template.setIn(["Outputs", "WeatherApiUrl"], {
  Description: "URL of the deployed weather API",
  Value: {
    "Fn::Sub": "https://${WeatherApi}.execute-api.${AWS::Region}.${AWS::URLSuffix}/${ApiStageName}/",
  },
});

for (const { value } of resources.items) {
  if (!isMap(value) || value.get("Type") !== "AWS::Serverless::Function") continue;
  // Explicit names from the standalone stack would collide across deployments.
  value.deleteIn(["Properties", "FunctionName"]);
}

const output = resolve(root, "pipeline/.build");
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "weather-api.yaml"), template.toString());
