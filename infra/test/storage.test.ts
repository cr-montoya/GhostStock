import { Match } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { synth } from "./helpers.js";

type Bucket = { Properties: Record<string, unknown> };

describe("storage", () => {
  it("[03-infra-pipeline 4.1] web and media buckets are private, encrypted and TLS only", () => {
    const { appTemplate } = synth();
    const buckets = Object.values(appTemplate.findResources("AWS::S3::Bucket") as Record<string, Bucket>);
    expect(buckets).toHaveLength(2);
    for (const bucket of buckets) {
      expect(bucket.Properties).toMatchObject({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
          ],
        },
        OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] },
      });
    }
    const policies = appTemplate.findResources("AWS::S3::BucketPolicy");
    const denyInsecure = Object.values(policies).filter((p) =>
      JSON.stringify(p).includes('"aws:SecureTransport":"false"'),
    );
    expect(denyInsecure).toHaveLength(2);
  });

  it("[03-infra-pipeline 4.2] media bucket expires tmp/ and allows only CORS POST", () => {
    const { appTemplate } = synth();
    appTemplate.hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({ Prefix: "tmp/", ExpirationInDays: 1, Status: "Enabled" }),
          Match.objectLike({ AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 } }),
        ]),
      },
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedMethods: ["POST"],
            AllowedOrigins: ["*"],
            AllowedHeaders: ["*"],
            MaxAge: 3000,
          },
        ],
      },
    });
    const withCors = Object.values(appTemplate.findResources("AWS::S3::Bucket") as Record<string, Bucket>)
      .filter((b) => "CorsConfiguration" in b.Properties);
    expect(withCors).toHaveLength(1);
  });

  it("[03-infra-pipeline 4.3] table has string PK/SK, on-demand, managed encryption, PITR", () => {
    const { appTemplate } = synth();
    appTemplate.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
    appTemplate.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
      ]),
      BillingMode: "PAY_PER_REQUEST",
      SSESpecification: { SSEEnabled: true, SSEType: "KMS" },
      Replicas: [
        Match.objectLike({
          PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
        }),
      ],
    });
  });
});
