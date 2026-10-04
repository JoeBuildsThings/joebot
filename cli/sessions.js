import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sessions');

export function newSessionId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${Math.random().toString(36).slice(2, 5)}`;
}

export function saveSession(session) {
  try {
    fs.mkdirSync(DIR, {recursive: true});
    const file = path.join(DIR, session.id + '.json');
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify({...session, updated: Date.now()}));
    fs.renameSync(temp, file);
  } catch {}
}

export function listSessions() {
  try {
    return fs
      .readdirSync(DIR)
      .filter(name => name.endsWith('.json'))
      .map(name => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
          return {
            id: data.id,
            title: data.title || 'Untitled',
            updated: data.updated || 0,
            count: (data.items || []).length
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

export function loadSession(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function ago(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
