import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";

// Service name, namespace and level come from POWERTOOLS_SERVICE_NAME,
// POWERTOOLS_METRICS_NAMESPACE (GhostStock) and POWERTOOLS_LOG_LEVEL, set per function by the infra.
export const logger = new Logger();

export const metrics = new Metrics();
