import { HonoContext } from 'hono';

export async function handleApiQueryEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    const body = await c.req.json();
    const { input, ...qdrantParams } = body;
    const model = 'text-embedding-3-small';
    if (!input) {
      return c.json({ error: 'Input is required for embedding generation' }, 400);
    }
    // Always generate embedding from input
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
    // Always set with_payload to true
    const qdrantBody = { ...qdrantParams, query: embedding, with_payload: true };
    const qdrantResponse = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.QDRANT_API_KEY,
      },
      body: JSON.stringify(qdrantBody),
    });
    if (!qdrantResponse.ok) {
      return c.json({ error: 'Failed to query Qdrant API' }, 500);
    }
    const qdrantData = await qdrantResponse.json();
    // Remove adContext from each payload in the response
    if (qdrantData?.result?.points) {
      for (const point of qdrantData.result.points) {
        if (point.payload && typeof point.payload === 'object') {
          delete point.payload.adContext;
        }
      }
    }
    return c.json(qdrantData, qdrantResponse.status);
  } catch (error) {
    console.error('Error in /api/query:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
