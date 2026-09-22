import {marked} from 'marked';
import {markedTerminal} from 'marked-terminal';

marked.use(
  markedTerminal({
    code: (text) => text,
    codespan: (text) => text,
    blockquote: (text) => text,
    firstHeading: (text) => text,
    heading: (text) => text
  })
);

export function renderMarkdown(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return text || '';
  }

  try {
    const rendered = marked.parse(text);
    return rendered.replace(/\n+$/, '');
  } catch {
    return text;
  }
}
