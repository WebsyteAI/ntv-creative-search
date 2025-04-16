// Use OpenAI to generate prompt recommendations for learning more about the ad
export async function promptRecommendationsAI(adContext: string, openaiApiKey: string): Promise<string[]> {
  const systemPrompt = `You are an expert at helping users explore and learn more about products and services. Given an ad context, generate a list of 3-5 engaging, specific, and helpful prompt recommendations (questions or requests) that a user could ask to learn more about the product, service, or offer described. Each prompt should be concise and focused on the information in the ad. Return as a JSON array of strings.`;
  const userPrompt = `Ad context:\n\n${adContext}\n\nGenerate prompt recommendations as described.`;

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
      max_tokens: 500,
      response_format: { type: 'json_array' }
    })
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI prompt recommendations error:', await openaiResponse.text());
    return [];
  }
  const data = await openaiResponse.json();
  try {
    const prompts = JSON.parse(data.choices[0].message.content);
    if (Array.isArray(prompts)) {
      return prompts.filter((p: any) => typeof p === 'string');
    }
    return [];
  } catch (e) {
    console.error('Failed to parse OpenAI prompt recommendations:', e, data);
    return [];
  }
}
