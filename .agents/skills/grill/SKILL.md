---
name: grill
description: >
  Adversarial stress test of a Kiro spec (and of readiness in the codebase) before
  implementation, and again before the PR. Surfaces gaps, ambiguity, hidden
  assumptions, missing contracts and risk. Ends with a hard verdict. Use after Kiro
  produces a spec, before starting a worktree, before /pr, or with /grill.
---

# Grill

Answer every item from the actual files (`.kiro/specs/<spec>/`, `.kiro/steering/`,
`packages/contracts`, code). Do not assume. Cite file and section for each finding.

## Checklist

### Ambiguity and scope
- [ ] Every acceptance criterion in EARS (`WHEN/IF/WHILE <trigger>, THE <system> SHALL
      <response>`) and testable. Flag "fast", "nice", "handle errors" without a number
      or a behavior.
- [ ] Smallest slice that serves the north star (upload -> analyze -> review -> save ->
      dashboard)? What is an explicit non-goal?

### Contracts
- [ ] Every request, response and error used by this spec exists in
      `packages/contracts` (zod) with an example payload.
- [ ] Error codes are a closed catalog shared by api and web.
- [ ] DynamoDB items and access patterns match the contracts.

### Ownership and parallelism
- [ ] Files this spec touches do not overlap another spec's ownership.
- [ ] Integration seams named (MSW mocks, contract imports, stack outputs).
- [ ] Each task has a verifiable "done" and can be built by an agent with only the
      spec and steering.

### AWS and Bedrock reality
- [ ] Bedrock: model id / inference profile, region, image size and format limits,
      30 s HTTP API timeout, structured output via forced tool use, invalid output path.
- [ ] Upload: presigned POST conditions (type, `content-length-range`), client resize.
- [ ] IAM least privilege per function; S3 private with OAC; throttling on public API.
- [ ] Pipeline: CodeConnections authorized, bootstrap, self-mutation, `enableTests`.

### Failure and edge cases
- [ ] Zero detections, partial candidates, model refusal, throttling, DynamoDB error,
      network loss mid-upload, huge or corrupt image, duplicate save.
- [ ] Never a fabricated success path.

### UX and identity
- [ ] Loading, empty, error and success states designed for each screen (Spanish copy).
- [ ] Reduced motion, AA contrast, keyboard, phone layout.

### Spec drift (pre-PR re-check)
- [ ] Code matches `design.md`; divergences reconciled in the spec first.
- [ ] `tasks.md` ticked; ADRs and `docs/` updated.

## Verdict
```
GRILL: <spec>
VERDICT: CLEAR | CLEAR WITH FIXES | DO NOT START
BLOCKERS: <numbered, file:section, concrete fix>
SHOULD-FIX: ...
QUESTIONS FOR THE OWNER: <only what the files cannot answer>
```
DO NOT START when any contract is missing, any AC is untestable, or ownership overlaps.
