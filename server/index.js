import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';

import {generate} from './ai/router.js';

import {
  createConversation,
  getConversation,
  listConversations,
  addMessage,
  renameConversation,
  deleteConversation
} from './conversations/manager.js';

import {extractExplicitMemory} from './ai/memory.js';

import {
  getMemories,
  removeMemory,
  clearMemories
} from './ai/profileMemory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = 8765;
const HOST = '127.0.0.1';

app.use(express.json({limit: '10mb'}));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/status', (req, res) => {
  res.json({
    name: 'JOEBOT',
    status: 'online',
    runtime: 'Termux',
    providers: ['gemini', 'groq', 'openrouter'],
    memory: {
      enabled: true,
      count: getMemories().length
    }
  });
});

app.get('/api/chats', (req, res) => {
  res.json(listConversations());
});

app.post('/api/chats', (req, res) => {
  const firstMessage =
    typeof req.body?.message === 'string' ? req.body.message : '';

  const chat = createConversation(firstMessage);

  res.status(201).json(chat);
});

app.get('/api/chats/:id', (req, res) => {
  const chat = getConversation(req.params.id);

  if (!chat) {
    return res.status(404).json({error: 'Chat not found'});
  }

  res.json(chat);
});

app.patch('/api/chats/:id', (req, res) => {
  const title =
    typeof req.body?.title === 'string' ? req.body.title.trim() : '';

  if (!title) {
    return res.status(400).json({error: 'Title is required'});
  }

  const chat = renameConversation(req.params.id, title);

  if (!chat) {
    return res.status(404).json({error: 'Chat not found'});
  }

  res.json(chat);
});

app.delete('/api/chats/:id', (req, res) => {
  const deleted = deleteConversation(req.params.id);

  if (!deleted) {
    return res.status(404).json({error: 'Chat not found'});
  }

  res.json({success: true});
});

app.post('/api/chats/:id/messages', async (req, res) => {
  try {
    const chat = getConversation(req.params.id);

    if (!chat) {
      return res.status(404).json({error: 'Chat not found'});
    }

    const message =
      typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!message) {
      return res.status(400).json({error: 'Message is required'});
    }

    const memorySaved = Boolean(extractExplicitMemory(message));

    const messages = [
      ...chat.messages.map(item => ({
        role: item.role,
        content: item.content
      })),
      {role: 'user', content: message}
    ];

    const result = await generate({messages});

    addMessage(req.params.id, 'user', message);
    addMessage(req.params.id, 'assistant', result.reply);

    const updatedChat = getConversation(req.params.id);

    res.json({
      chat: updatedChat,
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      memorySaved
    });
  } catch (error) {
    console.error('[JOEBOT] Chat error:', error.message);

    if (error.code === 'ALL_PROVIDERS_FAILED') {
      return res.status(503).json({
        error: 'JOEBOT is temporarily unable to reach its AI providers.'
      });
    }

    res.status(500).json({error: 'JOEBOT failed to generate a response.'});
  }
});

app.get('/api/memory', (req, res) => {
  res.json({memories: getMemories()});
});

app.delete('/api/memory', (req, res) => {
  clearMemories();
  res.json({success: true});
});

app.delete('/api/memory/:index', (req, res) => {
  const index = Number(req.params.index);
  const memories = getMemories();

  if (!Number.isInteger(index) || index < 0 || index >= memories.length) {
    return res.status(404).json({error: 'Memory not found'});
  }

  removeMemory(memories[index]);
  res.json({success: true});
});

app.listen(PORT, HOST, () => {
  console.log(`[JOEBOT] Online at http://${HOST}:${PORT}`);
});
