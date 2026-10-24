import { Duration, Fn, Stack } from "aws-cdk-lib";
import type * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
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
          origin: S3BucketOrigin.withOriginAccessControl(media),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: headers,
        },
      },
    });

    new s3deploy.BucketDeployment(this, "DeployWeb", {
      sources: [s3deploy.Source.asset(props.webDistDir)],
      destinationBucket: this.webBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
    });
  }
}
