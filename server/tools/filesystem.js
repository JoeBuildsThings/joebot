import {promises as fs} from 'fs';
import path from 'path';
import os from 'os';

const PROJECT_ROOT = process.cwd();
const HOME = os.homedir();
const STORAGE_LINK = path.join(HOME, 'storage', 'shared');

const BLOCKED_NAMES = ['.env', '.git', '.ssh', 'node_modules', '.git-credentials'];

let allowedRootsPromise = null;

async function getAllowedRoots() {
  if (allowedRootsPromise) {
    return allowedRootsPromise;
  }

  allowedRootsPromise = (async () => {
    const roots = [PROJECT_ROOT];

    try {
      const resolvedStorage = await fs.realpath(STORAGE_LINK);
      roots.push(resolvedStorage);
    } catch {
      // Storage not set up yet, project root only.
    }

    return roots;
  })();

  return allowedRootsPromise;
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveSafePath(inputPath) {
  const expanded = inputPath.startsWith('~')
    ? path.join(HOME, inputPath.slice(1))
    : inputPath;

  const base = path.isAbsolute(expanded) ? expanded : path.resolve(PROJECT_ROOT, expanded);

  let resolved;

  try {
    resolved = await fs.realpath(base);
  } catch {
    resolved = path.resolve(base);
  }

  const allowedRoots = await getAllowedRoots();
  const withinAllowedRoot = allowedRoots.some(root => isWithin(root, resolved));

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
