import { condenseInputWithAI } from '../extract/condenseInputWithAI';
import { HonoContext } from 'hono';

// Use OpenAI to generate minimal HTML summary for the top match
async function aiGenerateSimpleHtml(payload: any, openaiApiKey: string): Promise<string> {
  const systemPrompt = `You are an expert at summarizing and presenting information. Given a JSON object representing an ad (including fields like adContext, targetURL, etc), generate a single line of plain text summarizing the main value or offer, followed by a single anchor tag (using the targetURL field as the href) labeled 'Learn more'. The output should be minimal HTML: just the text and the anchor tag, nothing else. Example: "Headline - summary <a href=\"URL\">Learn more</a>"`;
  const userPrompt = `Ad object:\n\n${JSON.stringify(payload)}\n\nGenerate the minimal HTML as described.`;

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
      response_format: { type: 'text' }
    })
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI simple HTML error:', await openaiResponse.text());
    return '';
  }
  const data = await openaiResponse.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function handleSimpleEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    const { input, model = 'text-embedding-3-small', with_payload = true, ...qdrantParams } = await c.req.json();
    if (!input) {
      return c.json({ error: 'Input text is required for embedding generation' }, 400);
    }
    const condensedInput = await condenseInputWithAI(input, env.OPENAI_API_KEY);
    const openaiEmbeddingResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: condensedInput, model }),
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
    // Use AI to generate the minimal HTML, passing the full payload
    const html = await aiGenerateSimpleHtml(point.payload, env.OPENAI_API_KEY);
    return c.json({ html });
  } catch (error) {
    console.error('Error in /simple:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
