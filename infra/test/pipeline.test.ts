import { readFileSync } from "node:fs";
import { Annotations, Match } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CDK_ASSETS_CLI_VERSION } from "../lib/pipeline-stack.js";
import { synth, TEST_CONNECTION_ARN } from "./helpers.js";

type Project = { Properties: { Source: { BuildSpec: string }; Environment: Record<string, unknown> } };

function projects(context: Record<string, unknown> = {}) {
  const found = synth(context).pipeline.findResources("AWS::CodeBuild::Project") as Record<
    string,
    Project
  >;
  return Object.values(found).map((p) => ({
    spec: JSON.parse(p.Properties.Source.BuildSpec),
    env: p.Properties.Environment,
  }));
}

const commandsOf = (spec: { phases: { build: { commands: string[] } } }) => spec.phases.build.commands;
const findStep = (context: Record<string, unknown>, marker: string) =>
  projects(context).find((p) => commandsOf(p.spec).some((c: string) => c.includes(marker)));

describe("pipeline", () => {
  it("[03-infra-pipeline 2.1] self-mutating pipeline with a CodeConnections source", () => {
    const { pipeline } = synth({ connectionArn: TEST_CONNECTION_ARN });
    pipeline.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Name: "GhostStock",
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "Source",
          Actions: [
            Match.objectLike({
              ActionTypeId: Match.objectLike({ Provider: "CodeStarSourceConnection" }),
              Configuration: Match.objectLike({
                ConnectionArn: TEST_CONNECTION_ARN,
                FullRepositoryId: "cr-montoya/GhostStock",
                BranchName: "main",
              }),
            }),
          ],
        }),
        Match.objectLike({ Name: "UpdatePipeline" }),
      ]),
    });
  });

  it("[03-infra-pipeline 2.2] synth runs pnpm on Node.js 22 and outputs infra/cdk.out", () => {
    const step = findStep({}, "cdk synth");
    expect(step).toBeDefined();
    expect(commandsOf(step!.spec)).toEqual([
      "corepack enable",
      "pnpm install --frozen-lockfile",
      "pnpm build",
      'cd infra && pnpm exec cdk synth -c "connectionArn=$CONNECTION_ARN" -c "budgetEmail=$BUDGET_EMAIL"',
    ]);
    expect(step!.spec.phases.install["runtime-versions"]).toEqual({ nodejs: "22" });
    expect(step!.spec.artifacts["base-directory"]).toBe("infra/cdk.out");
    expect(step!.env.Image).toBe("aws/codebuild/standard:8.0");
  });

  it("[03-infra-pipeline 2.2] no step ever invokes npm, npx or yarn", () => {
    const all = projects({ enableTests: true }).flatMap((p) =>
      Object.values(p.spec.phases as Record<string, { commands?: string[] }>).flatMap(
        (phase) => phase.commands ?? [],
      ),
    );
    const ours = all.filter((c) => !c.startsWith("npm install -g aws-cdk") && !c.includes("cdk-assets"));
    for (const command of ours) expect(command).not.toMatch(/(^|\s)(npm|npx|yarn)\s/);
  });

  it("[03-infra-pipeline 2.3] persists connectionArn and budgetEmail as synth env vars", () => {
    const step = findStep(
      { connectionArn: TEST_CONNECTION_ARN, budgetEmail: "owner@example.com" },
      "cdk synth",
    );
    expect(step!.env.EnvironmentVariables).toEqual(
      expect.arrayContaining([
        { Name: "CONNECTION_ARN", Type: "PLAINTEXT", Value: TEST_CONNECTION_ARN },
        { Name: "BUDGET_EMAIL", Type: "PLAINTEXT", Value: "owner@example.com" },
      ]),
    );
  });

  it("[03-infra-pipeline 2.3] missing connectionArn synthesizes with a warning", () => {
    const { pipelineStack } = synth();
    Annotations.fromStack(pipelineStack).hasWarning(
      "/GhostStockPipeline",
      Match.stringLikeRegexp("connectionArn not set"),
    );
  });

  it("[03-infra-pipeline 2.4] deploys stage Prod with GhostStockAppStack", () => {
    const { pipeline, appStack } = synth();
    expect(appStack.stackName).toBe("Prod-GhostStockAppStack");
    pipeline.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "Prod",
          Actions: Match.arrayWith([
            Match.objectLike({
              Configuration: Match.objectLike({ StackName: "Prod-GhostStockAppStack" }),
            }),
          ]),
        }),
      ]),
    });
  });

  it("[03-infra-pipeline 3.1] has no test steps while enableTests is false", () => {
    expect(findStep({}, "pnpm test")).toBeUndefined();
    expect(findStep({}, "test:smoke")).toBeUndefined();
  });

  it("[03-infra-pipeline 3.2] adds pre unit + web-desktop and post smoke steps when enabled", () => {
    const context = { enableTests: true };
    const pre = findStep(context, "pnpm test");
    expect(commandsOf(pre!.spec)).toEqual([
      "corepack enable",
      "pnpm install --frozen-lockfile",
      "pnpm build",
      "pnpm test",
      "pnpm --filter @ghoststock/e2e exec playwright install --with-deps chromium",
      "pnpm --filter @ghoststock/e2e exec playwright test --project=web-desktop",
    ]);
    const post = findStep(context, "test:smoke");
    expect(commandsOf(post!.spec)).toContain("pnpm --filter @ghoststock/e2e test:smoke");

    const prod = (
      synth(context).pipeline.findResources("AWS::CodePipeline::Pipeline") as Record<
        string,
        { Properties: { Stages: { Name: string; Actions: { Name: string; RunOrder: number; Configuration: Record<string, unknown> }[] }[] } }
      >
    );
    const stage = Object.values(prod)[0]!.Properties.Stages.find((s) => s.Name === "Prod")!;
    const order = (name: string) => stage.Actions.find((a) => a.Name.includes(name))!.RunOrder;
    // 3.3: a failing pre step blocks the deploy; the smoke step runs after it.
    expect(order("Test")).toBeLessThan(order("Deploy"));
    expect(order("Smoke")).toBeGreaterThan(order("Deploy"));
    // BASE_URL comes from the stack output.
    const smoke = stage.Actions.find((a) => a.Name === "Smoke")!;
    expect(JSON.stringify(smoke.Configuration.EnvironmentVariables)).toContain("BASE_URL");
  });

  it("[03-infra-pipeline 3.2] every test step takes the full source as input", () => {
    const { pipeline } = synth({ enableTests: true });
    const stages = Object.values(
      pipeline.findResources("AWS::CodePipeline::Pipeline") as Record<
        string,
        { Properties: { Stages: { Name: string; Actions: { Name: string; InputArtifacts?: { Name: string }[] }[] }[] } }
      >,
    )[0]!.Properties.Stages;
    const sourceAction = stages[0]!.Actions[0] as unknown as { OutputArtifacts: { Name: string }[] };
    const sourceArtifact = sourceAction.OutputArtifacts[0]!.Name;
    const prod = stages.find((s) => s.Name === "Prod")!;
    for (const name of ["Test", "Smoke"]) {
      const action = prod.Actions.find((a) => a.Name === name)!;
      expect(action.InputArtifacts).toEqual([{ Name: sourceArtifact }]);
    }
  });

  it("[03-infra-pipeline 2.2] pins the CDK CLI and cdk-assets that generated steps install", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    // cliVersion is read from this field, so a range here would unpin the pipeline CLI.
    expect(pkg.devDependencies["aws-cdk"]).toMatch(/^\d+\.\d+\.\d+$/);
    const installs = projects({ enableTests: true }).flatMap(
      (p) => (p.spec.phases.install?.commands ?? []) as string[],
    );
    const npmGlobal = installs.filter((c) => c.startsWith("npm install -g"));
    expect(npmGlobal.length).toBeGreaterThan(0);
    expect(npmGlobal).toEqual(
      expect.arrayContaining([
        `npm install -g aws-cdk@${pkg.devDependencies["aws-cdk"]}`,
        `npm install -g cdk-assets@${CDK_ASSETS_CLI_VERSION}`,
      ]),
    );
    for (const command of npmGlobal) expect(command).not.toMatch(/@(latest|2)$/);
  });

  it("[ADR 0013] manual teardown project deletes only the app stack and is not a pipeline step", () => {
    const { pipeline } = synth({ connectionArn: TEST_CONNECTION_ARN });
    const teardown = Object.values(
      pipeline.findResources("AWS::CodeBuild::Project", { Properties: { Name: "GhostStock-Teardown" } }),
    ) as Project[];
    expect(teardown).toHaveLength(1);
    const commands = commandsOf(JSON.parse(teardown[0]!.Properties.Source.BuildSpec));
    expect(commands).toEqual([
      "aws cloudformation delete-stack --stack-name Prod-GhostStockAppStack",
      "aws cloudformation wait stack-delete-complete --stack-name Prod-GhostStockAppStack",
    ]);
    const stages = JSON.stringify(pipeline.findResources("AWS::CodePipeline::Pipeline"));
    expect(stages).not.toContain("Teardown");
  });
});
