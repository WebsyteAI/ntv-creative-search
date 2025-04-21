import { extractAdDataWithAI } from '../extract/extractAdDataWithAI';
import { promptRecommendationsAI } from '../extract/promptRecommendationsAI';
import { HonoContext } from 'hono';

export async function handleQueryEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  const qdrantUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333/collections/content_requests/points/query';
  const openaiUrl = 'https://api.openai.com/v1/embeddings';

  try {
    const { input, model = 'text-embedding-3-small', with_payload = true, ...qdrantParams } = await c.req.json();
    if (!input) {
      return c.json({ error: 'Input text is required for embedding generation' }, 400);
    }
    // Use the raw input for Qdrant embedding
    const openaiEmbeddingResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
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
    const qdrantResponse = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.QDRANT_API_KEY,
      },
      body: JSON.stringify({ ...qdrantParams, query: embedding, with_payload }),
    });
    if (!qdrantResponse.ok) {
      const error = await qdrantResponse.json();
      console.error('Error from Qdrant API:', error);
      return c.json({ error: 'Failed to query Qdrant API' }, 500);
    }
    const qdrantData = await qdrantResponse.json();
    const ads: { headline: string; ctaUrl: string; images: string[]; summary: string | null; promptRecommendations: string[] }[] = [];
    if (qdrantData?.result?.points) {
      await Promise.all(qdrantData.result.points.map(async (point: any) => {
        if (point.payload && typeof point.payload.adContext === 'string') {
          const { headline, ctaUrl, images, summary } = await extractAdDataWithAI(point.payload.adContext, env.OPENAI_API_KEY);
          const promptRecommendations = await promptRecommendationsAI(point.payload.adContext, env.OPENAI_API_KEY);
          point.payload.headline = headline;
          point.payload.ctaUrl = ctaUrl;
          point.payload.images = images;
          point.payload.summary = summary;
          point.payload.promptRecommendations = promptRecommendations;
          if (headline && ctaUrl && headline.trim() && ctaUrl.trim()) {
            ads.push({ headline: headline.trim(), ctaUrl: ctaUrl.trim(), images, summary, promptRecommendations });
          }
        }
      }));
    }
    const uniqueAds = Array.from(
      new Map(ads.map(a => [a.headline.toLowerCase() + '|' + a.ctaUrl, a])).values()
    );
    return c.json({
      ads: uniqueAds,
      condensedInput: input,
      ...qdrantData
    }, qdrantResponse.status);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
