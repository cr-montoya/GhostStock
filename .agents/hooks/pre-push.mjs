// pre-push gate: nothing is pushed straight to trunk. Trunk only moves through
// merged pull requests (GitHub branch protection is the server-side twin).
import { readFileSync } from 'node:fs';
import { TRUNK, fail } from './lib.mjs';

const lines = readFileSync(0, 'utf8').split('\n').filter(Boolean);
for (const line of lines) {
  const [, , remoteRef] = line.split(' ');
  if (remoteRef === `refs/heads/${TRUNK}`) {
    fail('no-direct-trunk', `Pushing to '${TRUNK}' is blocked. Push your branch and open a PR. See docs/git-workflow.md.`);
  }
}
