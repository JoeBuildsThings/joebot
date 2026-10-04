import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..');
const PROJECT_DIR = path.join(ROOT, 'skills');
const LEARNED_DIR = path.join(ROOT, 'data', 'skills');

const NAME_PATTERN = /^[a-z0-9_]{1,40}$/;
const MAX_BODY = 6000;
const MAX_DESCRIPTION = 160;
const MAX_LISTED = 20;

function parse(text) {
  const normalized = String(text).replace(/\r\n/g, '\n');
  const split = normalized.indexOf('\n\n');

  if (split < 0) {
    return null;
  }

  const header = normalized.slice(0, split);
  const body = normalized.slice(split + 2).trim();
  const fields = {};

  for (const line of header.split('\n')) {
    const at = line.indexOf(':');

    if (at > 0) {
      fields[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
    }
  }

  if (!NAME_PATTERN.test(fields.name || '') || !fields.description || !body) {
    return null;
  }

  return {
    name: fields.name,
    description: fields.description.slice(0, MAX_DESCRIPTION),
    body
  };
}

function readDir(dir, source) {
  let files = [];

  try {
    files = fs.readdirSync(dir).filter(file => file.endsWith('.md'));
  } catch {
    return [];
  }

  const found = [];

  for (const file of files) {
    try {
      const skill = parse(fs.readFileSync(path.join(dir, file), 'utf8'));

      if (skill && file === skill.name + '.md') {
        found.push({...skill, source});
      }
    } catch {}
  }

  return found;
}

export function listSkills() {
  const project = readDir(PROJECT_DIR, 'project');
  const taken = new Set(project.map(skill => skill.name));
  const learned = readDir(LEARNED_DIR, 'learned').filter(skill => !taken.has(skill.name));

  return [...project, ...learned].sort((a, b) => a.name.localeCompare(b.name));
}

export function getSkill(name) {
  if (!NAME_PATTERN.test(String(name || ''))) {
    return null;
  }

  return listSkills().find(skill => skill.name === name) || null;
}

export function saveSkill({name, description, body}) {
  const cleanName = String(name || '').trim();

  if (!NAME_PATTERN.test(cleanName)) {
    return {error: 'Skill name must use only lowercase letters, digits and underscores, up to 40 characters.'};
  }

  const cleanDescription = String(description || '').replace(/\s+/g, ' ').trim().slice(0, MAX_DESCRIPTION);
  const cleanBody = String(body || '').replace(/\r\n/g, '\n').trim();

  if (!cleanDescription) {
    return {error: 'A one line description is required.'};
  }

  if (!cleanBody) {
    return {error: 'The skill body is empty.'};
  }

  if (cleanBody.length > MAX_BODY) {
    return {error: `The skill body is too long. The limit is ${MAX_BODY} characters.`};
  }

  if (readDir(PROJECT_DIR, 'project').some(skill => skill.name === cleanName)) {
    return {error: 'That name belongs to a project skill and cannot be overwritten.'};
  }

  fs.mkdirSync(LEARNED_DIR, {recursive: true});

  const file = path.join(LEARNED_DIR, cleanName + '.md');
  const existed = fs.existsSync(file);

  fs.writeFileSync(file, `name: ${cleanName}\ndescription: ${cleanDescription}\n\n${cleanBody}\n`);

  return {status: existed ? 'updated' : 'saved', name: cleanName};
}

export function skillsBlock() {
  const skills = listSkills().slice(0, MAX_LISTED);

  if (!skills.length) {
    return '';
  }

  const lines = skills.map(skill => `* ${skill.name}: ${skill.description}`);

  return (
    'SKILLS\nSaved instructions you can load with use_skill. Call it before starting a task that matches one.\n' +
    lines.join('\n')
  );
}
