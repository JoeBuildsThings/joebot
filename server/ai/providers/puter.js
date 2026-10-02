import {init} from '@heyputer/puter.js/src/init.cjs';

let puterInstance = null;

function getPuter() {
  if (!puterInstance) {
    const token = process.env.PUTER_AUTH_TOKEN;

    if (!token) {
      throw new Error('Puter auth token is missing');
    }

    puterInstance = init(token);
  }

  return puterInstance;
}

export async function generate({model, messages, tools, toolChoice, onText}) {
  const puter = getPuter();

  const options = {};

  if (model && model !== 'default') {
    options.model = model;
  }

  if (tools && tools.length) {
    options.tools = tools;
    options.tool_choice = toolChoice || 'auto';
  }

  if (!onText) {
    const response = await puter.ai.chat(messages, options);
    const message = response?.message || {};

    return {
      reply: message.content || '',
      toolCalls: message.tool_calls || [],
      raw: response
    };
  }

  options.stream = true;

  const stream = await puter.ai.chat(messages, options);

  let reply = '';
  const toolCalls = [];

  for await (const part of stream) {
    if (part?.type === 'text' && part.text) {
      reply += part.text;
      onText(part.text);
    } else if (part?.type === 'tool_use') {
      toolCalls.push({
        id: part.id,
        type: 'function',
        function: {
          name: part.name,
          arguments: JSON.stringify(part.input || {})
        }
      });
    }
  }

  return {reply, toolCalls, raw: null};
}
