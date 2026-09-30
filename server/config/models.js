export default {
  all: [
    {provider: 'puter', model: 'default'},
    {provider: 'groq', model: 'openai/gpt-oss-120b'},
    {
      provider: 'openrouter',
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b'
    },
    {provider: 'gemini', model: 'gemini-3.6-flash'}
  ]
};
