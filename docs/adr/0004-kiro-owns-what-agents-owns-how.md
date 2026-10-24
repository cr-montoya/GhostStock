# ADR 0004: Kiro owns the what, `.agents/` owns the how

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** n/a

## Context

Kiro produces steering and specs; Claude Code grills, implements and reviews. Context
duplicated across tool-specific files drifts within hours and agents start obeying
stale copies.

## Options considered

1. **Split by responsibility with one router**: Kiro files hold product knowledge and
   contracts, `.agents/` holds the working method, `AGENTS.md` links both.
2. **Copy rules into each tool's own format** (`CLAUDE.md`, steering, etc.): rejected,
   guaranteed drift.

## Decision

- `.kiro/steering/` is the canonical product knowledge (vision, architecture, UI
  identity, security, AI rules). `.kiro/specs/<NN>-<slug>/` are the contracts
  (requirements in EARS, design, tasks).
- `.agents/` is the canonical harness: skills, agent briefs, git gates.
- `docs/` is the living documentation and the ADRs.
- `AGENTS.md` is the only router. No `CLAUDE.md` or other tool-specific instruction
  files. Content is linked, never copied.

## Consequences

- **Positive:** one place to change each fact; any tool can be swapped in.
- **Negative:** tools that do not read `AGENTS.md` natively need to be told to read it
  at session start.
- **Follow-up:** none.

## Well-Architected notes

Operational excellence: single source of truth for operating procedures.
