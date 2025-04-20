import { HonoContext } from 'hono';

export async function handleRawEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    const body = await c.req.json();
    let { input, vector, model = 'text-embedding-3-small', ...rest } = body;
    // If input is present, generate embedding
    if (input) {
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
      vector = openaiData.data[0]?.embedding;
      if (!vector) {
        return c.json({ error: 'No embedding returned from OpenAI API' }, 500);
      }
    }
    if (!vector) {
      return c.json({ error: 'Either input or vector must be provided' }, 400);
    }
    // Remove input from the body before sending to Qdrant
    const qdrantBody = { ...rest, vector, model };
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
