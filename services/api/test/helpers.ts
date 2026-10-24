import type { APIGatewayProxyEventV2, Context } from "aws-lambda";

export const REQUEST_ID = "Test-Request-Id=";

export function apiEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /api/test",
    rawPath: "/api/test",
    rawQueryString: "",
    headers: { "content-type": "application/json" },
    isBase64Encoded: false,
    requestContext: {
      accountId: "000000000000",
      apiId: "test",
      domainName: "example.test",
      domainPrefix: "example",
      http: { method: "POST", path: "/api/test", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "vitest" },
      requestId: REQUEST_ID,
      routeKey: "POST /api/test",
      stage: "$default",
      time: "24/Oct/2026:15:00:00 +0000",
      timeEpoch: 0,
    },
    ...overrides,
  };
}

export const lambdaContext = { awsRequestId: "lambda-request" } as Context;
