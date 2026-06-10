#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { readYaml, PATHS } from '../src/config.mjs';

const action = process.argv[2];
const ever = readYaml(PATHS.integrations).ever_jobs;
if (!existsSync(`${ever.directory}/.env`)) copyFileSync(`${ever.directory}/.env.example`, `${ever.directory}/.env`);
if (!['start', 'stop', 'install', 'start-local', 'stop-local'].includes(action)) throw new Error('Use start, stop, install, start-local, or stop-local');

const composePath = `${ever.directory}/docker-compose.yml`;
const compose = readFileSync(composePath, 'utf8');
const localCompose = compose.replace('"${PORT:-3001}:3001"', '"127.0.0.1:${PORT:-3001}:3001"');
if (localCompose !== compose) writeFileSync(composePath, localCompose);

const apiMainPath = `${ever.directory}/apps/api/src/main.ts`;
const apiMain = readFileSync(apiMainPath, 'utf8');
const localApiMain = apiMain.replace('await app.listen(port);', "await app.listen(port, '127.0.0.1');");
if (localApiMain !== apiMain) writeFileSync(apiMainPath, localApiMain);

function installLocal() {
  if (!existsSync(`${ever.directory}/node_modules`)) execFileSync('npm', ['ci'], { cwd: ever.directory, stdio: 'inherit' });
}

function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync('curl', ['-fsS', `${ever.base_url}/health`], { stdio: 'ignore' });
    if (result.status === 0) return true;
    spawnSync('sleep', ['1']);
  }
  return false;
}

if (action === 'install') {
  installLocal();
  process.exit(0);
}

const pidPath = 'data/ever-jobs-local.pid';
const logPath = 'data/logs/ever-jobs-local.log';

if (action === 'start-local') {
  mkdirSync('data/logs', { recursive: true });
  installLocal();
  const alreadyRunning = spawnSync('curl', ['-fsS', `${ever.base_url}/health`], { stdio: 'ignore' });
  if (alreadyRunning.status === 0) {
    console.log(`Ever Jobs local API already running: ${ever.base_url}`);
    process.exit(0);
  }
  const out = openSync('data/logs/ever-jobs-local.out.log', 'a');
  const err = openSync('data/logs/ever-jobs-local.err.log', 'a');
  const child = spawn('npm', ['run', 'start:dev'], {
    cwd: ever.directory,
    detached: true,
    env: { ...process.env, PORT: '3001', NODE_ENV: 'development' },
    stdio: ['ignore', out, err],
  });
  closeSync(out);
  closeSync(err);
  child.unref();
  writeFileSync(pidPath, `${child.pid}\n`);
  writeFileSync(logPath, `Started Ever Jobs local API pid ${child.pid}. Upstream logs are attached to the detached npm process.\n`);
  if (!waitForHealth()) throw new Error(`Ever Jobs local API did not become healthy at ${ever.base_url}/health`);
  console.log(`Ever Jobs local API: ${ever.base_url}`);
  process.exit(0);
}

if (action === 'stop-local') {
  if (!existsSync(pidPath)) {
    console.log('No local Ever Jobs pid file found.');
    process.exit(0);
  }
  const pid = Number(readFileSync(pidPath, 'utf8').trim());
  if (pid) {
    try { process.kill(-pid, 'SIGTERM'); } catch {}
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
  rmSync(pidPath, { force: true });
  console.log('Stopped local Ever Jobs API.');
  process.exit(0);
}

const args = ['compose', action === 'start' ? 'up' : 'down'];
if (action === 'start') args.push('-d', '--build');
execFileSync('docker', args, { cwd: ever.directory, stdio: 'inherit' });
