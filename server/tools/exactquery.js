let lastUserText = '';

export function setLastUserText(text) {
  lastUserText = String(text || '');
}

export function pickQuery(modelQuery) {
  const raw = lastUserText.trim();
  if (!raw || /^smart:/i.test(raw)) return modelQuery;
  const typed = raw
    .replace(/^(please\s+)?(can you\s+)?(search|google|look up|find)(\s+for|\s+up)?\s+/i, '')
    .trim();
  if (!typed || typed.length > 200) return modelQuery;
  return typed;
}
