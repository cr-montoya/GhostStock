// pre-commit gate: no commits on trunk + cheap secret scan on staged content.
import { TRUNK, currentBranch, stagedFiles, git, fail } from './lib.mjs';

const branch = currentBranch();
if (branch === TRUNK) {
  fail('no-direct-trunk', `Do not commit on '${TRUNK}'. Create a short-lived branch <type>/<spec>-<slug> and open a PR. See docs/git-workflow.md.`);
}

const forbiddenName = /(^|\/)(\.env(\..+)?|.+\.pem|secrets\/.+)$/;
const allowedName = /(^|\/)\.env\.example$/;
const secretPatterns = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/aws_secret_access_key\s*[=:]/i, 'AWS secret access key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
];

for (const file of stagedFiles()) {
  if (forbiddenName.test(file) && !allowedName.test(file)) {
    fail('secret-scan', `'${file}' must never be committed. Unstage it and use .env.example for documentation.`);
  }
  const content = git('show', `:${file}`);
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(content)) {
      fail('secret-scan', `Possible ${label} in '${file}'. Remove it; secrets live outside the repo.`);
    }
  }
}
