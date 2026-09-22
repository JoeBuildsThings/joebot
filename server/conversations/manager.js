import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const FILE = path.join(DATA_DIR, 'conversations.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, '{}');
  }
}

function load() {
  ensureStorage();

  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

    if (!data || typeof data !== 'object') {
      return {};
    }

    return migrate(data);
  } catch (error) {
    console.error('[JOEBOT] Failed to read conversations:', error.message);
    return {};
  }
}

function save(data) {
  ensureStorage();

  const tempFile = `${FILE}.tmp`;

  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, FILE);
}

function migrate(data) {
  let changed = false;

  for (const [id, value] of Object.entries(data)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Array.isArray(value.messages)
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      const firstUserMessage = value.find(
        message => message && message.role === 'user'
      );

      const firstMessage = firstUserMessage?.content || '';
      const now = new Date().toISOString();

      data[id] = {
        id,
        title: makeTitle(firstMessage),
        createdAt: value[0]?.timestamp || now,
        updatedAt: value[value.length - 1]?.timestamp || now,
        messages: value.map(message => ({
          id: crypto.randomUUID(),
          role: message.role,
          content: message.content,
          timestamp: message.timestamp || now
        }))
      };

      changed = true;
    }
  }

  if (changed) {
    console.log('[JOEBOT] Migrated old conversation data.');
    save(data);
  }

  return data;
}

function makeTitle(message) {
  if (!message || typeof message !== 'string') {
    return 'New conversation';
  }

  let title = message.replace(/\s+/g, ' ').trim();

  if (!title) {
    return 'New conversation';
  }

  title = title.replace(
    /^(hey|hi|hello|yo|bro|please|can you|could you)\s+/i,
    ''
  );

  if (title.length > 48) {
    title = `${title.slice(0, 45).trim()}...`;
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function createConversation(firstMessage = '') {
  const data = load();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const conversation = {
    id,
    title: makeTitle(firstMessage),
    createdAt: now,
    updatedAt: now,
    messages: []
  };

  data[id] = conversation;
  save(data);

  return conversation;
}

export function getConversation(id) {
  const data = load();
  return data[id] || null;
}

export function listConversations() {
  const data = load();

  return Object.values(data)
    .filter(
      conversation => conversation && Array.isArray(conversation.messages)
    )
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(conversation => ({
      id: conversation.id,
      title: conversation.title || 'New conversation',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages.length
    }));
}

export function addMessage(id, role, content) {
  const data = load();
  const conversation = data[id];

  if (!conversation) {
    throw new Error('Conversation not found.');
  }

  if (!Array.isArray(conversation.messages)) {
    conversation.messages = [];
  }

  conversation.messages.push({
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString()
  });

  conversation.messages = conversation.messages.slice(-100);
  conversation.updatedAt = new Date().toISOString();

  if (
    role === 'user' &&
    conversation.messages.filter(message => message.role === 'user')
      .length === 1
  ) {
    conversation.title = makeTitle(content);
  }

  save(data);

  return conversation;
}

export function renameConversation(id, title) {
  const data = load();
  const conversation = data[id];

  if (!conversation) {
    throw new Error('Conversation not found.');
  }

  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Title is required.');
  }

  conversation.title = title.trim().slice(0, 80);
  conversation.updatedAt = new Date().toISOString();

  save(data);

  return conversation;
}

export function deleteConversation(id) {
  const data = load();

  if (!data[id]) {
    return false;
  }

  delete data[id];
  save(data);

  return true;
}

export {makeTitle};
