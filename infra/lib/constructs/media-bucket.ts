import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

// Shared hardening for both buckets (security.md: BPA all, SSE-S3, TLS only, no ACLs).
export const PRIVATE_BUCKET_DEFAULTS = {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
  // Demo environment: teardown must leave nothing behind.
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
} satisfies s3.BucketProps;

// Raw uploads land in tmp/ through a presigned POST and expire after a day; saved
// product photos live in media/products/ and are served by CloudFront at /media/*.
export class MediaBucket extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.bucket = new s3.Bucket(this, "Bucket", {
      ...PRIVATE_BUCKET_DEFAULTS,
      lifecycleRules: [
        { id: "expire-tmp", prefix: "tmp/", expiration: Duration.days(1) },
        { id: "abort-multipart", abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
      // The signed POST policy is the authorization; a distribution-scoped origin
      // would create a CloudFormation cycle (ADR 0006).
      cors: [
        {
          allowedMethods: [s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });
  }
}
