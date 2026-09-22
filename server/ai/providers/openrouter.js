export async function generate({messages, model, tools, toolChoice}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const error = new Error('OpenRouter API key is missing');
    error.status = 503;
    throw error;
  }

  const body = {
    model,
    messages,
    ...(tools && tools.length ? {tools} : {}),
    ...(tools && tools.length && toolChoice ? {tool_choice: toolChoice} : {})
  };

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://127.0.0.1:8765',
        'X-Title': 'JOEBOT'
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'OpenRouter request failed');
    error.status = response.status;
    throw error;
  }

  const choice = data?.choices?.[0];

  return {
    reply: choice?.message?.content || '',
    toolCalls: choice?.message?.tool_calls || [],
    raw: data
  };
}
