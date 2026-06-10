#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const action = process.argv[2];
const cwd = process.cwd();
const label = 'com.rahulgupta.job-finder-workbench';
const agents = join(homedir(), 'Library', 'LaunchAgents');
const plist = join(agents, `${label}.plist`);

if (action === 'install') {
  mkdirSync(agents, { recursive: true });
  writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>cd "${cwd}" &amp;&amp; (npm run integrations:start || true) &amp;&amp; npm run scan -- --no-claude &gt;&gt; data/logs/scheduler.log 2&gt;&amp;1</string></array>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
</dict></plist>
`);
  execFileSync('launchctl', ['bootstrap', `gui/${process.getuid()}`, plist], { stdio: 'inherit' });
  console.log(`Installed ${plist}`);
} else if (action === 'remove') {
  if (existsSync(plist)) {
    execFileSync('launchctl', ['bootout', `gui/${process.getuid()}`, plist], { stdio: 'inherit' });
    unlinkSync(plist);
  }
  console.log('Scheduler removed');
} else {
  throw new Error('Use install or remove');
}
