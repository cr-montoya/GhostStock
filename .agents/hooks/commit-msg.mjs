// commit-msg gate:
// 1. Strips AI attribution (Co-authored-by trailers, "Generated with" lines):
//    commits are authored by the human who owns them, whatever tool drafted them.
// 2. Enforces the Conventional Commits header.
// 3. ADR gate: architecture-signal changes need a docs/adr/*.md in the same commit
//    (waiver: an "ADR-EXEMPT: <reason>" line in the message).
import { readFileSync, writeFileSync } from 'node:fs';
import { git, stagedFiles, addedFiles, fail } from './lib.mjs';

const msgFile = process.argv[2];
const raw = readFileSync(msgFile, 'utf8');

const attribution = /^(co-authored-by:.*|.*generated with .*|🤖.*)$/i;
const cleaned = raw
  .split('\n')
  .filter((line) => !attribution.test(line.trim()))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\s+$/, '\n');
if (cleaned !== raw) writeFileSync(msgFile, cleaned);

const header = cleaned.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? '';
if (/^(Merge|Revert|fixup!|squash!) /.test(header)) process.exit(0);

const conventional = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: [a-z0-9].{0,70}[^.]$/;
if (!conventional.test(header)) {
  fail('conventional-commit', `Invalid header: "${header}"\nExpected: <type>(<scope>): <imperative description, lowercase, no period, <= 72 chars>\nSee .agents/skills/commit/SKILL.md.`);
}

// --- ADR gate -------------------------------------------------------------
if (/^ADR-EXEMPT: .+/m.test(cleaned)) process.exit(0);
const staged = stagedFiles();
if (staged.some((f) => /^docs\/adr\/\d{4}-.+\.md$/.test(f))) process.exit(0);

const triggers = [];
const added = addedFiles();

// New workspace package or new CDK stack.
for (const f of added) {
  if (/(^|\/)package\.json$/.test(f) && f !== 'package.json') triggers.push(`new workspace package (${f})`);
  if (/^infra\/lib\/stacks\/.+\.ts$/.test(f)) triggers.push(`new CDK stack (${f})`);
}

// cdk.json is the environment/feature-flag contract.
if (staged.includes('infra/cdk.json')) triggers.push('infra/cdk.json changed');

// New runtime dependency in the backend or the infra.
for (const f of ['services/api/package.json', 'infra/package.json']) {
  if (!staged.includes(f) || added.includes(f)) continue;
  const before = safeDeps(git('show', `HEAD:${f}`));
  const after = safeDeps(git('show', `:${f}`));
  const fresh = Object.keys(after).filter((d) => !(d in before));
  if (fresh.length) triggers.push(`new runtime dependency in ${f}: ${fresh.join(', ')}`);
}

if (triggers.length) {
  fail('adr-gate', `This commit carries an architecture decision:\n  - ${triggers.join('\n  - ')}\nAdd the ADR (docs/adr/NNNN-<slug>.md, see .agents/skills/adr) to this same commit,\nor add a line "ADR-EXEMPT: <reason>" to the message as a written waiver.`);
}

function safeDeps(json) {
  try {
    return JSON.parse(json).dependencies ?? {};
  } catch {
    return {};
  }
}
