import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fallbackExtract } from './extract/fallbackExtract';
import { condenseInputWithAI } from './extract/condenseInputWithAI';
import { extractAdDataWithAI } from './extract/extractAdDataWithAI';

interface Env {
  QDRANT_API_KEY: string;
  OPENAI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());

app.post('/query', async (c) => {
  const qdrantApiKey = c.env.QDRANT_API_KEY;
  const openaiApiKey = c.env.OPENAI_API_KEY;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    const { input, model = 'text-embedding-3-small', with_payload = true, ...qdrantParams } = await c.req.json();
    if (!input) {
      return c.json({ error: 'Input text is required for embedding generation' }, 400);
    }
    const condensedInput = await condenseInputWithAI(input, openaiApiKey);
    const openaiEmbeddingResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({ input: condensedInput, model }),
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
    const qdrantData = await qdrantResponse.json();
    const ads: { headline: string; ctaUrl: string; images: string[]; summary: string | null }[] = [];
    if (qdrantData?.result?.points) {
      await Promise.all(qdrantData.result.points.map(async (point: any) => {
        if (point.payload && typeof point.payload.adContext === 'string') {
          let { headline, ctaUrl, images, summary } = await extractAdDataWithAI(point.payload.adContext, openaiApiKey);
          if (!headline || !ctaUrl || !images || images.length === 0) {
            const fallback = fallbackExtract(point.payload.adContext);
            if (!headline) headline = fallback.headline;
            if (!ctaUrl) ctaUrl = fallback.ctaUrl;
            if (!images || images.length === 0) images = fallback.images;
          }
          point.payload.headline = headline;
          point.payload.ctaUrl = ctaUrl;
          point.payload.images = images;
          point.payload.summary = summary;
          if (headline && ctaUrl && headline.trim() && ctaUrl.trim()) {
            ads.push({ headline: headline.trim(), ctaUrl: ctaUrl.trim(), images, summary });
          }
        }
      }));
    }
    const uniqueAds = Array.from(
      new Map(ads.map(a => [a.headline.toLowerCase() + '|' + a.ctaUrl, a])).values()
    );
    return c.json({
      ads: uniqueAds,
      condensedInput,
      ...qdrantData
    }, qdrantResponse.status);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
