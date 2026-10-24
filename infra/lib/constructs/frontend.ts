import { Annotations, Duration, Fn, RemovalPolicy, Stack } from "aws-cdk-lib";
import type * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { SPA_REWRITE_FILE } from "../paths.js";
import { PRIVATE_BUCKET_DEFAULTS } from "./media-bucket.js";

export interface FrontendProps {
  readonly mediaBucket: s3.IBucket;
  readonly httpApi: apigwv2.IHttpApi;
  /** Built SPA (`apps/web/dist`). */
  readonly webDistDir: string;
}

// The single public entry point (ADR 0006): SPA from the web bucket, /api/* to the
// HTTP API and /media/* to the media bucket, all behind one hardened distribution.
export class Frontend extends Construct {
  readonly distribution: cloudfront.Distribution;
  readonly webBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);
    const { region } = Stack.of(this);
    const media = props.mediaBucket;

    this.webBucket = new s3.Bucket(this, "WebBucket", PRIVATE_BUCKET_DEFAULTS);

    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      code: cloudfront.FunctionCode.fromFile({ filePath: SPA_REWRITE_FILE }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: "Rewrite extensionless SPA paths to /index.html",
    });

    // Both S3 host forms: the presigned POST URL host and the regional domain can
    // differ in us-east-1 (security.md).
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      `connect-src 'self' https://${media.bucketName}.s3.${region}.amazonaws.com https://${media.bucketName}.s3.amazonaws.com`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    const headers = new cloudfront.ResponseHeadersPolicy(this, "SecurityHeaders", {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        contentSecurityPolicy: { contentSecurityPolicy: csp, override: true },
      },
    });

    // CDK would grant the OAC read on the whole media bucket. Through a reference it
    // cannot edit the policy, so the grant below covers saved photos only and raw
    // uploads in tmp/ stay unreadable even if routing changes.
    const mediaRef = s3.Bucket.fromBucketAttributes(this, "MediaRef", {
      bucketArn: media.bucketArn,
      bucketName: media.bucketName,
      bucketRegionalDomainName: media.bucketRegionalDomainName,
    });

    // apiEndpoint is https://<id>.execute-api.<region>.amazonaws.com; keep the host.
    const apiDomain = Fn.select(2, Fn.split("/", props.httpApi.apiEndpoint));

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "GhostStock",
      defaultRootObject: "index.html",
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
        responseHeadersPolicy: headers,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new HttpOrigin(apiDomain),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          responseHeadersPolicy: headers,
        },
        "/media/*": {
          origin: S3BucketOrigin.withOriginAccessControl(mediaRef),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: headers,
        },
      },
    });

    // The policy CDK says it cannot write is the narrower one written here.
    Annotations.of(this).acknowledgeWarning(
      "@aws-cdk/aws-cloudfront-origins:updateImportedBucketPolicyOac",
      "Media bucket policy is added explicitly for media/products/* only.",
    );
    media.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontReadSavedPhotos",
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [media.arnForObjects("media/products/*")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${this.distribution.distributionId}`,
          },
        },
      }),
    );

    new s3deploy.BucketDeployment(this, "DeployWeb", {
      // Explicit group so the helper's logs expire and leave with the stack.
      logGroup: new logs.LogGroup(this, "DeployWebLogs", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      sources: [s3deploy.Source.asset(props.webDistDir)],
      destinationBucket: this.webBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
    });
  }
}
