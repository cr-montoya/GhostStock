import { monotonicFactory } from "ulid";

// Monotonic so ids minted in the same millisecond (one batch of products) still sort
// in creation order, which keeps "newest first" stable (ADR 0005).
const nextUlid = monotonicFactory();

export function ulid(): string {
  return nextUlid();
}
