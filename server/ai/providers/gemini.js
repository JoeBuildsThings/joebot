function stripUnsupportedSchemaKeys(node) {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedSchemaKeys);
  }

  if (node && typeof node === 'object') {
    const cleaned = {};

    for (const [key, value] of Object.entries(node)) {
      if (key === 'additionalProperties' || key === '$schema') {
        continue;
      }

      cleaned[key] = stripUnsupportedSchemaKeys(value);
    }

    return cleaned;
  }

  return node;
}

export async function generate({messages, model, tools, toolChoice}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is missing');
  }

  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{text: m.content}]
    }));

  const systemMessage = messages.find(m => m.role === 'system')?.content || '';

  const geminiTools =
    tools && tools.length
      ? [
          {
            functionDeclarations: tools.map(tool => ({
              name: tool.function.name,
              description: tool.function.description,
              parameters: stripUnsupportedSchemaKeys(tool.function.parameters)
            }))
          }
        ]
      : undefined;

  const body = {
    systemInstruction: {parts: [{text: systemMessage}]},
    contents,
    ...(geminiTools ? {tools: geminiTools} : {})
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Gemini request failed');
    error.status = response.status;
    throw error;
  }

  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const text = parts
    .filter(part => part.text)
    .map(part => part.text)
    .join('');

  const functionCalls = parts
    .filter(part => part.functionCall)
    .map((part, index) => ({
      id: `gemini-call-${index}-${Date.now()}`,
      type: 'function',
      function: {
        name: part.functionCall.name,
        arguments: JSON.stringify(part.functionCall.args || {})
      }
    }));

  return {
    reply: text,
    toolCalls: functionCalls,
    raw: data
  };
}
