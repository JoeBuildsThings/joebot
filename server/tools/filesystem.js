import {promises as fs} from 'fs';
import path from 'path';
import os from 'os';

const PROJECT_ROOT = process.cwd();
const HOME = os.homedir();
const STORAGE_ROOT = path.join(HOME, 'storage', 'shared');

const ALLOWED_ROOTS = [PROJECT_ROOT, STORAGE_ROOT];

const BLOCKED_NAMES = ['.env', '.git', '.ssh', 'node_modules', '.git-credentials'];

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveSafePath(inputPath) {
  const base = path.isAbsolute(inputPath) ? inputPath : path.resolve(PROJECT_ROOT, inputPath);

  let resolved;

  try {
    resolved = await fs.realpath(base);
  } catch {
    resolved = path.resolve(base);
  }

  const withinAllowedRoot = ALLOWED_ROOTS.some(root => isWithin(root, resolved));

  if (!withinAllowedRoot) {
    throw new Error('Path is outside the allowed project and storage folders.');
  }

  const segments = resolved.split(path.sep);
  const hitsBlocked = segments.some(segment => BLOCKED_NAMES.includes(segment));

  if (hitsBlocked) {
    throw new Error('That path is blocked for safety reasons.');
  }

  return resolved;
}

export async function readFile(inputPath) {
  const target = await resolveSafePath(inputPath);
  const content = await fs.readFile(target, 'utf8');
  return {path: inputPath, content};
}

export async function writeFile(inputPath, content) {
  const target = await resolveSafePath(inputPath);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, content, 'utf8');
  return {path: inputPath, bytesWritten: Buffer.byteLength(content, 'utf8')};
}

export async function listFiles(inputPath = '.') {
  const target = await resolveSafePath(inputPath);
  const entries = await fs.readdir(target, {withFileTypes: true});

  return entries
    .filter(entry => entry.name !== 'node_modules' && !entry.name.startsWith('.'))
    .map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file'
    }));
}
