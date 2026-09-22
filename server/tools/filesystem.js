import {promises as fs} from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();

function resolveSafePath(relativePath) {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);

  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error('Path escapes the project directory and is not allowed.');
  }

  return resolved;
}

export async function readFile(relativePath) {
  const target = resolveSafePath(relativePath);
  const content = await fs.readFile(target, 'utf8');
  return {path: relativePath, content};
}

export async function writeFile(relativePath, content) {
  const target = resolveSafePath(relativePath);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, content, 'utf8');
  return {path: relativePath, bytesWritten: Buffer.byteLength(content, 'utf8')};
}

export async function listFiles(relativePath = '.') {
  const target = resolveSafePath(relativePath);
  const entries = await fs.readdir(target, {withFileTypes: true});

  return entries
    .filter(entry => entry.name !== 'node_modules' && !entry.name.startsWith('.'))
    .map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file'
    }));
}
