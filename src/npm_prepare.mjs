import { spawnSync } from 'child_process';

if (process.env.npm_command === 'install') {
  process.exit(0);
}

const result = spawnSync(process.execPath, ['src/main.mjs', 'prepare', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
