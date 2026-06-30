import { execFileSync } from 'node:child_process';

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

run('node', ['scripts/generate-llms.mjs']);

const diff = output('git', ['diff', '--name-only']);
if (diff) {
  console.error('Generated artifacts are not up to date. Review and commit these files:');
  console.error(diff);
  process.exit(1);
}

console.log('Generated artifacts are up to date.');
