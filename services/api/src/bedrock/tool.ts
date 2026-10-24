import type { Tool, ToolInputSchema } from "@aws-sdk/client-bedrock-runtime";
import { ModelOutputJsonSchema } from "@ghoststock/contracts";

export const REPORT_PRODUCTS_TOOL_NAME = "report_products";

/** The only output channel of the model; its schema is generated from `ModelOutputSchema`. */
export const REPORT_PRODUCTS_TOOL: Tool = {
  toolSpec: {
    name: REPORT_PRODUCTS_TOOL_NAME,
    description:
      "Report the distinct sellable products visible in the photo. Call it with an empty products list when nothing is recognizable.",
    inputSchema: { json: ModelOutputJsonSchema as ToolInputSchema.JsonMember["json"] },
  },
};
