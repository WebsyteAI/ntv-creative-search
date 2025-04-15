import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  QDRANT_API_KEY: string; // Secret for the Qdrant API key
  OPENAI_API_KEY: string; // Secret for the OpenAI API key
}

// Helper to extract headlines and real CTA URLs from adContext
function extractHeadlinesAndUrls(adContext: string): { headlines: string[]; ctaUrls: string[] } {
  const headlines: string[] = [];
  const ctaUrls: string[] = [];

  // Extract headlines
  const headlineRegex = /\[Headlines\]\s*([\s\S]*?)(?:\n\n|\[Page Content\])/;
  const headlineMatch = headlineRegex.exec(adContext);
  if (headlineMatch && headlineMatch[1]) {
    headlines.push(...headlineMatch[1].split('\n').map(h => h.trim()).filter(Boolean));
  }

  // Extract CTA URLs (real URLs, not PRX_CLICK_URL placeholders)
  // Match href="..." and extract URLs that are not PRX_CLICK_URL or variants
  const urlRegex = /href="([^"]+)"/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(adContext)) !== null) {
    const url = urlMatch[1];
    // Exclude PRX_CLICK_URL and similar placeholders
    if (!/PRX_CLICK_URL/i.test(url) && /^https?:\/\//.test(url)) {
      ctaUrls.push(url);
    }
  }

  return { headlines, ctaUrls };
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors());

// Proxy the Qdrant query points endpoint with OpenAI embedding generation
app.post('/query', async (c) => {
  const qdrantApiKey = c.env.QDRANT_API_KEY;
  const openaiApiKey = c.env.OPENAI_API_KEY;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    // Extract input text and other parameters from the request body
    const { input, model = 'text-embedding-3-small', with_payload = true, ...qdrantParams } = await c.req.json();

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
      body: JSON.stringify({ ...qdrantParams, query: embedding, with_payload }),
    });

    if (!qdrantResponse.ok) {
      const error = await qdrantResponse.json();
      console.error('Error from Qdrant API:', error);
      return c.json({ error: 'Failed to query Qdrant API' }, 500);
    }

    // Return the response from the Qdrant API, but add headlines and ctaUrls to each payload
    const qdrantData = await qdrantResponse.json();
    if (qdrantData?.result?.points) {
      for (const point of qdrantData.result.points) {
        if (point.payload && typeof point.payload.adContext === 'string') {
          const { headlines, ctaUrls } = extractHeadlinesAndUrls(point.payload.adContext);
          point.payload.headlines = headlines;
          point.payload.ctaUrls = ctaUrls;
        }
      }
    }
    return c.json(qdrantData, qdrantResponse.status);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
