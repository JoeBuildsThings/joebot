import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }

  if (!fs.existsSync(PROFILE_FILE)) {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify({memories: []}, null, 2));
  }
}

function load() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(PROFILE_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (!data || !Array.isArray(data.memories)) {
      return {memories: []};
    }

    return {
      memories: data.memories.filter(item => typeof item === 'string')
    };
  } catch (error) {
    console.error('[JOEBOT] Failed to read profile memory:', error.message);
    return {memories: []};
  }
}

function save(data) {
  ensureStorage();

  const safeData = {
    memories: Array.isArray(data?.memories)
      ? data.memories.filter(item => typeof item === 'string')
      : []
  };

  fs.writeFileSync(PROFILE_FILE, JSON.stringify(safeData, null, 2));
}

export function getMemories() {
  return load().memories;
}

export function addMemory(memory) {
  if (typeof memory !== 'string' || !memory.trim()) {
    return false;
  }

  const data = load();
  const value = memory.trim();

  const exists = data.memories.some(
    item => item.toLowerCase() === value.toLowerCase()
  );

  if (!exists) {
    data.memories.push(value);
    data.memories = data.memories.slice(-100);
    save(data);
    return true;
  }

  return false;
}

export function removeMemory(memory) {
  if (typeof memory !== 'string') {
    return;
  }

  const data = load();

  data.memories = data.memories.filter(
    item => item.toLowerCase() !== memory.trim().toLowerCase()
  );

  save(data);
}

export function clearMemories() {
  save({memories: []});
}
