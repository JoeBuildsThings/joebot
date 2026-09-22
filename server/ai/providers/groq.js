export async function generate({
  messages,
  model,
  temperature = 0.7,
  maxTokens,
  tools,
  toolChoice
}) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('Groq API key is missing');
  }

  const body = {
    model,
    messages,
    temperature,
    ...(maxTokens ? {max_tokens: maxTokens} : {}),
    ...(tools && tools.length ? {tools} : {}),
    ...(tools && tools.length && toolChoice ? {tool_choice: toolChoice} : {})
  };

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Groq request failed with status ${response.status}`
    );
  }

  const choice = data?.choices?.[0];

  if (!choice) {
    throw new Error('Groq returned an invalid response');
  }

  return {
    reply: choice.message?.content || '',
    toolCalls: choice.message?.tool_calls || [],
    raw: data
  };
}
