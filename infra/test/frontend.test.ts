import { Match } from "aws-cdk-lib/assertions";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { SPA_REWRITE_FILE } from "../lib/paths.js";
import { synth } from "./helpers.js";

type Behavior = Record<string, unknown> & { PathPattern?: string };
type DistributionConfig = {
  DefaultCacheBehavior: Behavior;
  CacheBehaviors: Behavior[];
  Origins: { Id: string; DomainName: unknown; S3OriginConfig?: unknown; OriginAccessControlId?: unknown }[];
  CustomErrorResponses?: unknown;
  HttpVersion: string;
  DefaultRootObject: string;
};

const { appTemplate, appStack } = synth();
const distribution = () =>
  (Object.values(appTemplate.findResources("AWS::CloudFront::Distribution"))[0] as {
    Properties: { DistributionConfig: DistributionConfig };
  }).Properties.DistributionConfig;
const behavior = (path: string) => distribution().CacheBehaviors.find((b) => b.PathPattern === path)!;
const originOf = (b: Behavior) => distribution().Origins.find((o) => o.Id === b.TargetOriginId)!;
const resolved = (value: unknown) => JSON.stringify(appStack.resolve(value));

// Managed policy ids (AWS docs).
const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
const CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6";
const ALL_VIEWER_EXCEPT_HOST = "b689b0a8-53d0-40ab-baf2-68738e2966ac";

describe("distribution", () => {
  it("[03-infra-pipeline 6.1] default behavior serves the web bucket via OAC with the SPA rewrite", () => {
    const d = distribution();
    expect(d.DefaultRootObject).toBe("index.html");
    expect(d.DefaultCacheBehavior).toMatchObject({
      ViewerProtocolPolicy: "redirect-to-https",
      FunctionAssociations: [{ EventType: "viewer-request", FunctionARN: expect.anything() }],
    });
    const origin = originOf(d.DefaultCacheBehavior);
    expect(origin.OriginAccessControlId).toBeDefined();
    expect(resolved(origin.DomainName)).toContain("FrontendWebBucket");
    appTemplate.resourceCountIs("AWS::CloudFront::OriginAccessControl", 2);
  });

  it("[03-infra-pipeline 6.1] /api/* goes to the HTTP API uncached with viewer headers except Host", () => {
    const api = behavior("/api/*");
    expect(api).toMatchObject({
      AllowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
      CachePolicyId: CACHING_DISABLED,
      OriginRequestPolicyId: ALL_VIEWER_EXCEPT_HOST,
      ViewerProtocolPolicy: "https-only",
    });
    expect(resolved(originOf(api).DomainName)).toContain("HttpApi");
  });

  it("[03-infra-pipeline 6.1] /media/* goes to the media bucket via OAC, cache optimized", () => {
    const media = behavior("/media/*");
    expect(media).toMatchObject({ CachePolicyId: CACHING_OPTIMIZED, ViewerProtocolPolicy: "redirect-to-https" });
    const origin = originOf(media);
    expect(origin.OriginAccessControlId).toBeDefined();
    expect(resolved(origin.DomainName)).toContain("MediaBucket");
  });

  it("[03-infra-pipeline 6.1] CloudFront may read only saved photos, never tmp/ uploads", () => {
    const policies = Object.values(
      appTemplate.findResources("AWS::S3::BucketPolicy") as Record<
        string,
        { Properties: { Bucket: unknown; PolicyDocument: { Statement: { Principal?: { Service?: string }; Resource: unknown; Action: unknown }[] } } }
      >,
    ).filter((p) => resolved(p.Properties.Bucket).includes("MediaBucket"));
    const cloudfrontReads = policies
      .flatMap((p) => p.Properties.PolicyDocument.Statement)
      .filter((s) => s.Principal?.Service === "cloudfront.amazonaws.com");
    expect(cloudfrontReads).toHaveLength(1);
    expect(cloudfrontReads[0]!.Action).toBe("s3:GetObject");
    expect(resolved(cloudfrontReads[0]!.Resource)).toMatch(/"\/media\/products\/\*"\]\]\}$/);
    // Without this condition any distribution could read saved photos.
    const condition = (cloudfrontReads[0] as { Condition?: { StringEquals?: Record<string, unknown> } })
      .Condition?.StringEquals?.["AWS:SourceArn"];
    expect(resolved(condition)).toMatch(
      /^\{"Fn::Join":\["",\["arn:aws:cloudfront::\d{12}:distribution\/",\{"Ref":"FrontendDistribution[^"]+"\}\]\]\}$/,
    );
  });

  it("[03-infra-pipeline 6.2] HTTPS (redirect for SPA and media, reject on /api/*), HTTP/2 and 3, headers", () => {
    expect(distribution().DefaultCacheBehavior.ViewerProtocolPolicy).toBe("redirect-to-https");
    expect(behavior("/media/*").ViewerProtocolPolicy).toBe("redirect-to-https");
    // Redirecting a POST would drop its body, so plain HTTP on the API is rejected.
    expect(behavior("/api/*").ViewerProtocolPolicy).toBe("https-only");
    expect(distribution().HttpVersion).toBe("http2and3");
    const policies = appTemplate.findResources("AWS::CloudFront::ResponseHeadersPolicy");
    const config = (Object.values(policies)[0] as {
      Properties: { ResponseHeadersPolicyConfig: { SecurityHeadersConfig: Record<string, unknown> } };
    }).Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig;
    expect(config).toMatchObject({
      StrictTransportSecurity: { AccessControlMaxAgeSec: 31536000, IncludeSubdomains: true, Override: true },
      ContentTypeOptions: { Override: true },
      FrameOptions: { FrameOption: "DENY", Override: true },
      ReferrerPolicy: { ReferrerPolicy: "strict-origin-when-cross-origin", Override: true },
    });
    const csp = resolved((config.ContentSecurityPolicy as { ContentSecurityPolicy: unknown }).ContentSecurityPolicy);
    for (const directive of [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
    // Both S3 host forms of the media bucket, built from its name.
    expect(csp).toMatch(/connect-src 'self' https:\/\/",\{"Ref":"MediaBucket[^"]+"\},"\.s3\.us-east-1\.amazonaws\.com https:\/\/",\{"Ref":"MediaBucket[^"]+"\},"\.s3\.amazonaws\.com/);
    // Every behavior carries the same headers policy.
    const all = [distribution().DefaultCacheBehavior, ...distribution().CacheBehaviors];
    expect(new Set(all.map((b) => JSON.stringify(b.ResponseHeadersPolicyId))).size).toBe(1);
  });

  it("[03-infra-pipeline 6.3] has no distribution-wide custom error responses", () => {
    expect(distribution().CustomErrorResponses).toBeUndefined();
  });
});

describe("spa rewrite function", () => {
  const source = readFileSync(SPA_REWRITE_FILE, "utf8");
  const run = (uri: string) =>
    (runInNewContext(`${source}; handler({ request: { uri: ${JSON.stringify(uri)} } })`) as { uri: string }).uri;

  it("[03-infra-pipeline 6.1] rewrites extensionless paths and keeps files, API and media", () => {
    expect(run("/")).toBe("/index.html");
    expect(run("/inventario")).toBe("/index.html");
    expect(run("/productos/01J0000000000000000000000")).toBe("/index.html");
    expect(run("/assets/index-abc.js")).toBe("/assets/index-abc.js");
    expect(run("/favicon.svg")).toBe("/favicon.svg");
    expect(run("/api/unknown")).toBe("/api/unknown");
    expect(run("/media/products/x")).toBe("/media/products/x");
  });

  it("[03-infra-pipeline 6.1] is attached as a cloudfront-js-2.0 viewer request function", () => {
    appTemplate.hasResourceProperties("AWS::CloudFront::Function", {
      FunctionConfig: Match.objectLike({ Runtime: "cloudfront-js-2.0" }),
      FunctionCode: source,
    });
  });
});

describe("web publishing", () => {
  it("[03-infra-pipeline 7.1] deploys the web build with a full invalidation", () => {
    appTemplate.hasResourceProperties("Custom::CDKBucketDeployment", {
      DestinationBucketName: Match.anyValue(),
      DistributionId: Match.anyValue(),
      DistributionPaths: ["/*"],
    });
  });

  it("[03-infra-pipeline 7.2] outputs BaseUrl as https://<distribution domain>", () => {
    const outputs = appTemplate.findOutputs("BaseUrl");
    const value = resolved(Object.values(outputs)[0]!.Value);
    expect(value).toMatch(/^\{"Fn::Join":\["",\["https:\/\/",\{"Fn::GetAtt":\["FrontendDistribution[^"]+","DomainName"\]\}\]\]\}$/);
  });
});
