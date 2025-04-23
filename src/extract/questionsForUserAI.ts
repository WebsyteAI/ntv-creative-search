// Use OpenAI to generate questions the ad would want to ask the user
export async function questionsForUserAI(adContext: string | object, openaiApiKey: string): Promise<string[]> {
  const context = typeof adContext === 'string' ? adContext : JSON.stringify(adContext);
  const systemPrompt = `You are an expert at conversational marketing. Given a context, generate a list of 3 engaging, specific, and helpful questions that the product, service, or advertiser would want to ask the user to better understand their needs, preferences, or intent. All questions should be related to the industry, product, or service described in the context, but should not mention that it is an ad or advertisement. Return as a JSON object: { "questions": [ ... ] }`;
  const userPrompt = `Context:\n\n${context}\n\nGenerate questions for the user as described.`;

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
      response_format: { type: 'json_object' }
    })
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI questions for user error:', await openaiResponse.text());
    return [];
  }
  const data = await openaiResponse.json();
  try {
    const obj = JSON.parse(data.choices[0].message.content);
    if (obj && Array.isArray(obj.questions)) {
      return obj.questions.filter((q: any) => typeof q === 'string').slice(0, 3);
    }
    return [];
  } catch (e) {
    console.error('Failed to parse OpenAI questions for user:', e, data);
    return [];
  }
}
