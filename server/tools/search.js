import {promises as fs} from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const IGNORED_DIRS = new Set(['node_modules', '.git', 'data']);
const MAX_RESULTS = 40;

async function walk(directory, query, results) {
  if (results.length >= MAX_RESULTS) {
    return;
  }

  const entries = await fs.readdir(directory, {withFileTypes: true});

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) {
      return;
    }

    if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walk(fullPath, query, results);
      continue;
    }

    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (results.length >= MAX_RESULTS) {
          return;
        }

        if (line.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            file: path.relative(PROJECT_ROOT, fullPath),
            line: index + 1,
            text: line.trim().slice(0, 200)
          });
        }
      });
    } catch {
      continue;
    }
  }
}

export async function searchCode(query, relativePath = '.') {
  const target = path.resolve(PROJECT_ROOT, relativePath);
  const results = [];

  await walk(target, query, results);

  return {query, matches: results, truncated: results.length >= MAX_RESULTS};
}
