import { HonoContext } from 'hono';

// Use OpenAI to generate a question and button link for the top match
async function aiGenerateButtonData(payload: any, openaiApiKey: string): Promise<{ question: string, buttonLink: string }> {
  const systemPrompt = `You are an expert at summarizing and presenting information. Given a JSON object representing an ad (including fields like adContext, targetURL, etc), generate:\n- question: A single, concise question a user might ask to learn more about the offer (e.g., 'What are the key features of this product?').\n- buttonLink: The best CTA URL from the object (use the targetURL field).\nReturn as a JSON object: { "question": string, "buttonLink": string }`;
  const userPrompt = `Ad object:\n\n${JSON.stringify(payload)}\n\nGenerate the object as described.`;

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
      max_tokens: 300,
      response_format: { type: 'json_object' }
    })
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI button data error:', await openaiResponse.text());
    return { question: '', buttonLink: '' };
  }
  const data = await openaiResponse.json();
  try {
    const obj = JSON.parse(data.choices[0].message.content);
    return {
      question: typeof obj.question === 'string' ? obj.question : '',
      buttonLink: typeof obj.buttonLink === 'string' ? obj.buttonLink : ''
    };
  } catch (e) {
    console.error('Failed to parse OpenAI button data:', e, data);
    return { question: '', buttonLink: '' };
  }
}

export async function handleButtonEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    const { input, model = 'text-embedding-3-small', with_payload = true, ...qdrantParams } = await c.req.json();
    if (!input) {
      return c.json({ error: 'Input text is required for embedding generation' }, 400);
    }
    // Use the raw input for Qdrant embedding
    const openaiEmbeddingResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input, model }),
    });
    if (!openaiEmbeddingResponse.ok) {
      return c.json({ error: 'Failed to generate embedding from OpenAI API' }, 500);
    }
    const openaiData = await openaiEmbeddingResponse.json();
    const embedding = openaiData.data[0]?.embedding;
    if (!embedding) {
      return c.json({ error: 'No embedding returned from OpenAI API' }, 500);
    }
    const qdrantResponse = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.QDRANT_API_KEY,
      },
      body: JSON.stringify({ ...qdrantParams, query: embedding, with_payload, limit: 1 }),
    });
    if (!qdrantResponse.ok) {
      return c.json({ error: 'Failed to query Qdrant API' }, 500);
    }
    const qdrantData = await qdrantResponse.json();
    const point = qdrantData?.result?.points?.[0];
    if (!point || !point.payload) {
      return c.json({ error: 'No match found' }, 404);
    }
    // Use AI to generate the question and buttonLink, passing the full payload
    const result = await aiGenerateButtonData(point.payload, env.OPENAI_API_KEY);
    return c.json(result);
  } catch (error) {
    console.error('Error in /button:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
