const MAX_RESULTS = 5;

export async function searchWeb(query) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error('Tavily API key is missing');
  }

  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('A search query is required');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      api_key: apiKey,
      query: query.trim(),
      max_results: MAX_RESULTS,
      include_answer: true
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `Tavily request failed with status ${response.status}`);
  }

  const results = (data.results || []).map(item => ({
    title: item.title,
    url: item.url,
    snippet: item.content
  }));

  return {
    query: query.trim(),
    answer: data.answer || null,
    results
  };
}
