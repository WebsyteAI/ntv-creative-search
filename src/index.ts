import { Hono } from 'hono';

interface Env {
  QDRANT_API_KEY: string; // Secret for the Qdrant API key
  OPENAI_API_KEY: string; // Secret for the OpenAI API key
}

const app = new Hono<{ Bindings: Env }>();

// Proxy the Qdrant query points endpoint with OpenAI embedding generation
app.post('/query', async (c) => {
  const qdrantApiKey = c.env.QDRANT_API_KEY;
  const openaiApiKey = c.env.OPENAI_API_KEY;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    // Extract input text and other parameters from the request body
    const { input, model = 'text-embedding-3-small', ...qdrantParams } = await c.req.json();

    if (!input) {
      return c.json({ error: 'Input text is required for embedding generation' }, 400);
    }

    // Step 1: Generate embedding using OpenAI API
    const openaiResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({ input, model }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json();
      console.error('Error from OpenAI API:', error);
      return c.json({ error: 'Failed to generate embedding from OpenAI API' }, 500);
    }

    const openaiData = await openaiResponse.json();
    const embedding = openaiData.data[0]?.embedding;

    if (!embedding) {
      return c.json({ error: 'No embedding returned from OpenAI API' }, 500);
    }

    // Step 2: Send the embedding to Qdrant API
    const qdrantResponse = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': qdrantApiKey,
      },
      body: JSON.stringify({ ...qdrantParams, query: embedding, with_payload: true }),
    });

    if (!qdrantResponse.ok) {
      const error = await qdrantResponse.json();
      console.error('Error from Qdrant API:', error);
      return c.json({ error: 'Failed to query Qdrant API' }, 500);
    }

    // Return the response from the Qdrant API
    const qdrantData = await qdrantResponse.json();
    return c.json(qdrantData, qdrantResponse.status);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;