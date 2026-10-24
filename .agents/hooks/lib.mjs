// Shared helpers for the git-native gates. Harness-neutral: these run for any
// committer (human, Kiro, Claude Code, Codex) because git invokes them.
import { execFileSync } from 'node:child_process';

export const TRUNK = 'main';

export function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function currentBranch() {
  return git('symbolic-ref', '--quiet', '--short', 'HEAD');
}

export function stagedFiles() {
  const out = git('diff', '--cached', '--name-only', '--diff-filter=ACMR');
  return out ? out.split('\n') : [];
}

export function addedFiles() {
  const out = git('diff', '--cached', '--name-only', '--diff-filter=A');
  return out ? out.split('\n') : [];
}

export function fail(gate, message) {
  process.stderr.write(`\n[${gate}] ${message}\n\n`);
  process.exit(1);
}
