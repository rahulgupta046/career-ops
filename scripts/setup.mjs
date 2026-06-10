#!/usr/bin/env node
import { execFileSync, spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { readYaml, PATHS } from '../src/config.mjs';

const config = readYaml(PATHS.integrations);
const ever = config.ever_jobs;

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

mkdirSync('.integrations', { recursive: true });
if (!existsSync(ever.directory)) run('git', ['clone', ever.repository, ever.directory]);
run('git', ['fetch', '--all'], { cwd: ever.directory });
run('git', ['checkout', '--detach', ever.commit], { cwd: ever.directory });
if (!existsSync(`${ever.directory}/.env`)) copyFileSync(`${ever.directory}/.env.example`, `${ever.directory}/.env`);
if (!existsSync('.venv/bin/python')) run('python3', ['-m', 'venv', '.venv']);
run('.venv/bin/pip', ['install', 'python-jobspy==1.1.82']);
run('.venv/bin/python', ['-c', 'from jobspy import scrape_jobs; print(\"JobSpy import OK\")']);
let sidecarStarted = true;
try {
  run('docker', ['compose', 'up', '-d', '--build'], { cwd: ever.directory });
} catch {
  sidecarStarted = false;
  console.warn('Ever Jobs Docker sidecar could not start. Start Docker Desktop and run npm run integrations:start later.');
}
let healthy = false;
for (let attempt = 0; sidecarStarted && attempt < 30; attempt += 1) {
  const result = spawnSync('curl', ['-fsS', `${ever.base_url}/health`], { stdio: 'ignore' });
  if (result.status === 0) { healthy = true; break; }
  spawnSync('sleep', ['2']);
}
if (sidecarStarted && !healthy) console.warn(`Ever Jobs health check did not pass at ${ever.base_url}/health.`);
else console.log('Ever Jobs health check OK');
console.log('Setup complete. Run npm run ui.');
