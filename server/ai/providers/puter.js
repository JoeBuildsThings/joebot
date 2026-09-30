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

export async function generate({messages, tools, toolChoice}) {
  const puter = getPuter();

  const options = {};

  if (tools && tools.length) {
    options.tools = tools;
    options.tool_choice = toolChoice || 'auto';
  }

  const response = await puter.ai.chat(messages, options);

  const message = response?.message || {};

  return {
    reply: message.content || '',
    toolCalls: message.tool_calls || [],
    raw: response
  };
}
