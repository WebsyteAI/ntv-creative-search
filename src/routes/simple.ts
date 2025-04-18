import { condenseInputWithAI } from '../extract/condenseInputWithAI';
import { fallbackExtract } from '../extract/fallbackExtract';
import { HonoContext } from 'hono';

export async function handleSimpleEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    const { input, model = 'text-embedding-3-small', with_payload = true, ...qdrantParams } = await c.req.json();
    if (!input) {
      return c.text('Input text is required for embedding generation', 400);
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
      return c.text('Failed to generate embedding from OpenAI API', 500);
    }
    const openaiData = await openaiEmbeddingResponse.json();
    const embedding = openaiData.data[0]?.embedding;
    if (!embedding) {
      return c.text('No embedding returned from OpenAI API', 500);
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
      return c.text('Failed to query Qdrant API', 500);
    }
    const qdrantData = await qdrantResponse.json();
    const point = qdrantData?.result?.points?.[0];
    if (!point || !point.payload || typeof point.payload.adContext !== 'string') {
      return c.text('No match found', 404);
    }
    // Only fallback extraction for headline, ctaUrl, summary
    const { headline, ctaUrl, summary } = fallbackExtract(point.payload.adContext);
    // Return a simple HTML snippet
    const html = `<div><strong>${headline || ''}</strong><br>${summary || ''}<br><a href="${ctaUrl || '#'}" target="_blank" rel="noopener">Learn more</a></div>`;
    return c.html(html);
  } catch (error) {
    console.error('Error in /simple:', error);
    return c.text('Internal server error', 500);
  }
}
