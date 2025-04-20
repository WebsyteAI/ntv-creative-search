import { HonoContext } from 'hono';

export async function handleRawEndpoint(c: HonoContext<any, any, any>) {
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
    // Use 'query' instead of 'vector' for Qdrant
    const qdrantBody = { ...qdrantParams, query: embedding };
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
    return c.json(qdrantData, qdrantResponse.status);
  } catch (error) {
    console.error('Error in /raw:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
