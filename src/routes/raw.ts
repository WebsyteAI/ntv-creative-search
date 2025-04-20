import { HonoContext } from 'hono';

export async function handleRawEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';

  try {
    const body = await c.req.json();
    const qdrantResponse = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.QDRANT_API_KEY,
      },
      body: JSON.stringify(body),
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
