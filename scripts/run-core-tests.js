'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const testDir = path.join(root, 'test');
const files = fs.readdirSync(testDir)
  .filter(name => name.endsWith('.test.cjs'))
  .sort()
  .map(name => path.join('test', name));

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

process.exitCode = result.status == null ? 1 : result.status;
