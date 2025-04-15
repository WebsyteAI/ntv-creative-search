import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  QDRANT_API_KEY: string; // Secret for the Qdrant API key
  OPENAI_API_KEY: string; // Secret for the OpenAI API key
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors());

// Helper: Use OpenAI to extract a headline and a real CTA URL from adContext
async function extractHeadlineAndUrlWithAI(adContext: string, openaiApiKey: string): Promise<{ headline: string | null; ctaUrl: string | null }> {
  const systemPrompt = `You are an expert at extracting marketing information from HTML and text. Given an ad context, extract:\n- headline: The most prominent or relevant headline (as plain text, not HTML).\n- ctaUrl: The first real call-to-action URL (must be a valid https?:// URL, not a placeholder like PRX_CLICK_URL).\nReturn a JSON object: { "headline": string | null, "ctaUrl": string | null }.`;

  const userPrompt = `Ad context:\n\n${adContext}\n\nExtract headline and ctaUrl as described.`;

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
      max_tokens: 128,
      response_format: { type: 'json_object' }
    })
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI extraction error:', await openaiResponse.text());
    return { headline: null, ctaUrl: null };
  }

  const data = await openaiResponse.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      headline: typeof parsed.headline === 'string' ? parsed.headline : null,
      ctaUrl: typeof parsed.ctaUrl === 'string' ? parsed.ctaUrl : null
    };
  } catch (e) {
    console.error('Failed to parse OpenAI extraction:', e, data);
    return { headline: null, ctaUrl: null };
  }
}

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
    const openaiEmbeddingResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({ input, model }),
    });

    if (!openaiEmbeddingResponse.ok) {
      const error = await openaiEmbeddingResponse.json();
      console.error('Error from OpenAI API:', error);
      return c.json({ error: 'Failed to generate embedding from OpenAI API' }, 500);
    }

    const openaiData = await openaiEmbeddingResponse.json();
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

    // Process the response from the Qdrant API
    const qdrantData = await qdrantResponse.json();
    if (qdrantData?.result?.points) {
      // Run OpenAI extraction in parallel for all points
      await Promise.all(qdrantData.result.points.map(async (point: any) => {
        if (point.payload && typeof point.payload.adContext === 'string') {
          const { headline, ctaUrl } = await extractHeadlineAndUrlWithAI(point.payload.adContext, openaiApiKey);
          point.payload.headline = headline;
          point.payload.ctaUrl = ctaUrl;
        }
      }));
    }
    return c.json(qdrantData, qdrantResponse.status);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
