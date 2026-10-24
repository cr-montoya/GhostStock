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
    ["analyses", 1024, 28, 5],
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
      "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    );
    expect(fn("inventory").Environment.Variables).toMatchObject({
      TABLE_NAME: expect.anything(),
      LOW_STOCK_DEFAULT: "5",
    });
  });

  it("[03-infra-pipeline 5.1] explicit log groups keep 14 days", () => {
    appTemplate.resourcePropertiesCountIs("AWS::Logs::LogGroup", { RetentionInDays: 14 }, 4);
  });

  it("[03-infra-pipeline 5.1] bundling is ESM, bundles every module and adds the require banner", () => {
    const fns = appStack.node
      .findAll()
      .filter((c) => c.node.id === "Function" && c.node.scope?.node.id.match(/Uploads|Analyses|Inventory/));
    expect(fns).toHaveLength(3);
    // Bundling options are not in the template; read them from the source of truth.
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
    expect(actions(s)).toEqual(["bedrock:InvokeModel", "s3:GetObject", "s3:ListBucket"]);
    const get = s.find((x) => x.Action === "s3:GetObject")!;
    expect(resolve(get.Resource)).toMatch(/\/tmp\/\*/);
    const list = s.find((x) => x.Action === "s3:ListBucket")!;
    expect(list.Condition).toEqual({ StringLike: { "s3:prefix": "tmp/*" } });
    const bedrock = s.find((x) => x.Action === "bedrock:InvokeModel")!;
    expect(resolve(bedrock.Resource)).toBe(
      JSON.stringify([
        `arn:aws:bedrock:us-east-1:${TEST_ACCOUNT}:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0`,
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
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

