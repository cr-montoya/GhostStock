import { Match } from "aws-cdk-lib/assertions";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { synth, TEST_ACCOUNT } from "./helpers.js";

type Fn = {
  Properties: {
    Runtime: string;
    Architectures: string[];
    MemorySize: number;
    Timeout: number;
    ReservedConcurrentExecutions?: number;
    Environment: { Variables: Record<string, unknown> };
    Role: { "Fn::GetAtt": [string, string] };
    LoggingConfig?: { LogGroup: { Ref: string } };
  };
};
type Statement = { Effect: string; Action: string | string[]; Resource: unknown; Condition?: unknown };

const { appTemplate, appStack } = synth();

function fn(service: string) {
  const all = appTemplate.findResources("AWS::Lambda::Function") as Record<string, Fn>;
  const match = Object.values(all).find(
    (f) => f.Properties.Environment?.Variables?.POWERTOOLS_SERVICE_NAME === service,
  );
  if (!match) throw new Error(`function ${service} not found`);
  return match.Properties;
}

function statements(service: string): Statement[] {
  const roleId = fn(service).Role["Fn::GetAtt"][0];
  const policies = appTemplate.findResources("AWS::IAM::Policy") as Record<
    string,
    { Properties: { Roles: { Ref: string }[]; PolicyDocument: { Statement: Statement[] } } }
  >;
  return Object.values(policies)
    .filter((p) => p.Properties.Roles.some((r) => r.Ref === roleId))
    .flatMap((p) => p.Properties.PolicyDocument.Statement);
}

const resolve = (value: unknown) => JSON.stringify(appStack.resolve(value));
const actions = (s: Statement[]) => s.flatMap((x) => [x.Action].flat()).sort();

describe("functions", () => {
  it.each([
    ["uploads", 256, 10, undefined],
    ["analyses", 1024, 28, undefined],
    ["inventory", 256, 10, undefined],
  ])("[03-infra-pipeline 5.1] %s runs Node.js 22 arm64 with its limits", (name, memory, timeout, reserved) => {
    const props = fn(name);
    expect(props.Runtime).toBe("nodejs22.x");
    expect(props.Architectures).toEqual(["arm64"]);
    expect(props.MemorySize).toBe(memory);
    expect(props.Timeout).toBe(timeout);
    expect(props.ReservedConcurrentExecutions).toBe(reserved);
    expect(props.Environment.Variables).toMatchObject({
      POWERTOOLS_SERVICE_NAME: name,
      POWERTOOLS_METRICS_NAMESPACE: "GhostStock",
      POWERTOOLS_LOG_LEVEL: "INFO",
      MEDIA_BUCKET: expect.anything(),
    });
    expect(props.LoggingConfig?.LogGroup.Ref).toBeDefined();
  });

  it("[03-infra-pipeline 5.1] env carries model id, table and low stock default", () => {
    expect(fn("analyses").Environment.Variables.BEDROCK_MODEL_ID).toBe(
      "us.amazon.nova-pro-v1:0",
    );
    expect(fn("inventory").Environment.Variables).toMatchObject({
      TABLE_NAME: expect.anything(),
      LOW_STOCK_DEFAULT: "5",
    });
  });

  it.each(["uploads", "analyses", "inventory"])(
    "[03-infra-pipeline 5.1] %s logs to its own log group with 14 day retention",
    (name) => {
      const groupId = fn(name).LoggingConfig!.LogGroup.Ref;
      const group = appTemplate.toJSON().Resources[groupId];
      expect(group.Type).toBe("AWS::Logs::LogGroup");
      expect(group.Properties.RetentionInDays).toBe(14);
    },
  );

  it("[03-infra-pipeline 5.1] ApiFunction source declares ESM, no externals and the require banner", () => {
    const fns = appStack.node
      .findAll()
      .filter((c) => c.node.id === "Function" && c.node.scope?.node.id.match(/Uploads|Analyses|Inventory/));
    expect(fns).toHaveLength(3);
    // Bundling options never reach the template; this checks the construct source, and
    // the real bundle is exercised by `cdk synth` (see docs/deployment.md).
    const source = readFileSync(new URL("../lib/constructs/api-function.ts", import.meta.url), "utf8");
    expect(source).toContain("externalModules: []");
    expect(source).toContain("format: OutputFormat.ESM");
    expect(source).toContain("const require = createRequire(import.meta.url);");
  });

  it("[03-infra-pipeline 5.2] uploads can only PutObject on tmp/*", () => {
    const s = statements("uploads");
    expect(actions(s)).toEqual(["s3:PutObject"]);
    expect(resolve(s[0]!.Resource)).toMatch(/\/tmp\/\*/);
  });

  it("[03-infra-pipeline 5.2] analyses reads tmp/, lists with tmp/* prefix and invokes the model", () => {
    const s = statements("analyses");
    expect(actions(s)).toEqual([
      "bedrock:InvokeModel",
      "bedrock:InvokeModel",
      "s3:GetObject",
      "s3:ListBucket",
    ]);
    const get = s.find((x) => x.Action === "s3:GetObject")!;
    expect(resolve(get.Resource)).toMatch(/\/tmp\/\*/);
    const list = s.find((x) => x.Action === "s3:ListBucket")!;
    expect(list.Condition).toEqual({ StringLike: { "s3:prefix": "tmp/*" } });
    const profileArn = `arn:aws:bedrock:us-east-1:${TEST_ACCOUNT}:inference-profile/us.amazon.nova-pro-v1:0`;
    const bedrock = s.filter((x) => x.Action === "bedrock:InvokeModel");
    expect(bedrock.map((x) => ({ resource: resolve(x.Resource), condition: x.Condition }))).toEqual(
      expect.arrayContaining([
        { resource: JSON.stringify(profileArn), condition: undefined },
        {
          resource: JSON.stringify("arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0"),
          // Only through the inference profile, never as a direct model call.
          condition: { StringEquals: { "bedrock:InferenceProfileArn": profileArn } },
        },
      ]),
    );
  });

  it("[03-infra-pipeline 5.2] inventory gets the table actions, tmp/ reads and media/products writes", () => {
    const s = statements("inventory");
    expect(actions(s)).toEqual([
      "dynamodb:BatchWriteItem",
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:UpdateItem",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:PutObject",
    ]);
    expect(resolve(s.find((x) => x.Action === "s3:PutObject")!.Resource)).toMatch(/\/media\/products\/\*/);
    expect(resolve(s.find((x) => x.Action === "s3:GetObject")!.Resource)).toMatch(/\/tmp\/\*/);
    expect(s.find((x) => x.Action === "s3:ListBucket")!.Condition).toEqual({
      StringLike: { "s3:prefix": "tmp/*" },
    });
    expect(JSON.stringify(s)).not.toContain("dynamodb:Scan");
  });
});

describe("http api", () => {
  it("[03-infra-pipeline 5.3] defines every route plus $default", () => {
    const routes = Object.values(
      appTemplate.findResources("AWS::ApiGatewayV2::Route") as Record<string, { Properties: { RouteKey: string } }>,
    )
      .map((r) => r.Properties.RouteKey)
      .sort();
    expect(routes).toEqual(
      [
        "$default",
        "DELETE /api/products/{id}",
        "GET /api/products",
        "GET /api/products/{id}",
        "GET /api/settings",
        "POST /api/analyses",
        "POST /api/products",
        "POST /api/uploads",
        "PUT /api/products/{id}",
        "PUT /api/settings",
      ].sort(),
    );
  });

  it("[03-infra-pipeline 5.3] $default and every inventory route reach the inventory function", () => {
    const resources = appTemplate.toJSON().Resources as Record<string, { Type: string; Properties: Record<string, unknown> }>;
    const functionIdOf = (service: string) =>
      Object.entries(resources).find(
        ([, r]) =>
          r.Type === "AWS::Lambda::Function" &&
          (r.Properties.Environment as Fn["Properties"]["Environment"] | undefined)?.Variables
            ?.POWERTOOLS_SERVICE_NAME === service,
      )![0];
    const functionBehind = (routeKey: string) => {
      const route = Object.values(resources).find(
        (r) => r.Type === "AWS::ApiGatewayV2::Route" && r.Properties.RouteKey === routeKey,
      )!;
      const integrationId = JSON.stringify(route.Properties.Target).match(/"Ref":"([^"]+)"/)![1]!;
      const uri = JSON.stringify(resources[integrationId]!.Properties.IntegrationUri);
      return uri.match(/"Fn::GetAtt":\["([^"]+)","Arn"\]/)![1];
    };
    const inventory = functionIdOf("inventory");
    for (const key of [
      "$default",
      "GET /api/products",
      "POST /api/products",
      "GET /api/products/{id}",
      "PUT /api/products/{id}",
      "DELETE /api/products/{id}",
      "GET /api/settings",
      "PUT /api/settings",
    ]) {
      expect(functionBehind(key), key).toBe(inventory);
    }
    expect(functionBehind("POST /api/uploads")).toBe(functionIdOf("uploads"));
    expect(functionBehind("POST /api/analyses")).toBe(functionIdOf("analyses"));
  });

  it("[03-infra-pipeline 5.3] throttles the default stage and writes JSON access logs", () => {
    appTemplate.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      AutoDeploy: true,
      DefaultRouteSettings: Match.objectLike({ ThrottlingBurstLimit: 10, ThrottlingRateLimit: 5 }),
      AccessLogSettings: {
        DestinationArn: Match.anyValue(),
        Format: Match.stringLikeRegexp('"requestId":"\\$context.requestId"'),
      },
    });
  });

  it("[03-infra-pipeline 5.3] has no CORS configuration", () => {
    const apis = Object.values(appTemplate.findResources("AWS::ApiGatewayV2::Api"));
    expect(apis).toHaveLength(1);
    expect(JSON.stringify(apis[0])).not.toContain("CorsConfiguration");
  });
});

