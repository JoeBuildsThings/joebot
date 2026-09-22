import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

import {addMemory as addPersonalMemory} from './profileMemory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const LEGACY_FILE = path.join(DATA_DIR, 'legacy-sessions.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }

  if (!fs.existsSync(LEGACY_FILE)) {
    fs.writeFileSync(LEGACY_FILE, '{}');
  }
}

function load() {
  ensureStorage();

  try {
    return JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  ensureStorage();
  fs.writeFileSync(LEGACY_FILE, JSON.stringify(data, null, 2));
}

export function getConversation(sessionId) {
  const data = load();
  return data[sessionId] || [];
}

export function addMessage(sessionId, role, content) {
  const data = load();

  if (!data[sessionId]) {
    data[sessionId] = [];
  }

  data[sessionId].push({
    role,
    content,
    timestamp: new Date().toISOString()
  });

  data[sessionId] = data[sessionId].slice(-30);

  save(data);
}

export function extractExplicitMemory(content) {
  if (typeof content !== 'string') {
    return null;
  }

  const text = content.trim();

  const patterns = [
    /^remember that (.+)$/i,
    /^remember (.+)$/i,
    /^don't forget that (.+)$/i,
    /^dont forget that (.+)$/i,
    /^my name is (.+)$/i,
    /^call me (.+)$/i,
    /^i am (.+)$/i,
    /^i'm (.+)$/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const value = match[1].trim();

    if (!value) {
      continue;
    }

    let memory;

    if (/^my name is /i.test(text)) {
      memory = `The user's name is ${value}.`;
    } else if (/^call me /i.test(text)) {
      memory = `The user prefers to be called ${value}.`;
    } else {
      memory = value;
    }

    addPersonalMemory(memory);

    return memory;
  }

  return null;
}

export function clearConversation(sessionId) {
  const data = load();
  delete data[sessionId];
  save(data);
}
