import { AppError } from "../lib/errors.js";
import { withErrors } from "../lib/http.js";

// Entry point wired by the infra (spec 03). Answers in the error envelope until its
// task in spec 01 lands, so the stack can synth and deploy early.
export const handler = withErrors(async () => {
  throw new AppError("INTERNAL_ERROR", "Not implemented");
});
