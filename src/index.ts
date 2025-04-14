import { Hono } from 'hono';

interface Env {
  QDRANT_API_KEY: string; // Secret for the Qdrant API key
}

const app = new Hono<{ Bindings: Env }>();

// Proxy the Qdrant query points endpoint
app.post('/query', async (c) => {
  const apiKey = c.env.QDRANT_API_KEY;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';

  try {
    // Forward the request body to the Qdrant API
    const requestBody = await c.req.json();

    const response = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    // Return the response from the Qdrant API
    const responseData = await response.json();
    return c.json(responseData, response.status);
  } catch (error) {
    console.error('Error querying Qdrant API:', error);
    return c.json({ error: 'Failed to query Qdrant API' }, 500);
  }
});

export default app;