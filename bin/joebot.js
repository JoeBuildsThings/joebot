#!/usr/bin/env node

import {spawn} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = path.join(__dirname, '..', 'cli', 'tui', 'App.jsx');
const tsx = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const envFile = '/data/data/com.termux/files/home/joebot/.env';

const child = spawn(
  tsx,
  [`--env-file=${envFile}`, app],
  {
    stdio: 'inherit',
    env: process.env
  }
);

child.on('exit', code => {
  process.exit(code ?? 0);
});

child.on('error', error => {
  console.error('Failed to start JOEBOT:', error.message);
  process.exit(1);
});
