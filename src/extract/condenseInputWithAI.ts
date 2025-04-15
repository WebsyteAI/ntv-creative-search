// Use OpenAI to summarize/shorten the input for Qdrant queries
export async function condenseInputWithAI(input: string, openaiApiKey: string): Promise<string> {
  const systemPrompt = `You are an expert at search query optimization. Given a long or verbose user message, rewrite it as a short, focused search query that will work well for semantic search in a vector database. Remove unnecessary details, keep it concise, and focus on the main topic or intent.`;
  const userPrompt = `Original message:\n${input}\n\nRewrite as a short, focused search query:`;

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0,
      max_tokens: 32,
      response_format: { type: 'text' }
    })
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI input condense error:', await openaiResponse.text());
    return input;
  }
  const data = await openaiResponse.json();
  const condensed = data.choices?.[0]?.message?.content?.trim();
  return condensed && condensed.length > 0 ? condensed : input;
}
