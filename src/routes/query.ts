import { extractAdDataWithAI } from '../extract/extractAdDataWithAI';
import { promptRecommendationsAI } from '../extract/promptRecommendationsAI';
import { questionsForUserAI } from '../extract/questionsForUserAI';
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
    const points = qdrantData?.result?.points || [];
    // Limit to top 10 for performance (optional)
    const topPoints = points.slice(0, 10);
    // Parallelize all AI calls for each ad
    const ads = await Promise.all(
      topPoints.map(async (point: any) => {
        if (!point.payload || typeof point.payload.adContext !== 'string') return null;
        const adContext = point.payload.adContext;
        // Run all AI calls in parallel
        const [adData, promptRecs, questionsForUser] = await Promise.all([
          extractAdDataWithAI(adContext, env.OPENAI_API_KEY),
          promptRecommendationsAI(adContext, env.OPENAI_API_KEY),
          questionsForUserAI(adContext, env.OPENAI_API_KEY),
        ]);
        const advertiser = point.payload.advertiser || null;
        const advertiser_logo_url = point.payload.advertiser_logo_url || null;
        const { headline, ctaUrl, images, summary } = adData;
        if (headline && ctaUrl && headline.trim() && ctaUrl.trim()) {
          return {
            headline: headline.trim(),
            ctaUrl: ctaUrl.trim(),
            images,
            summary,
            promptRecommendations: promptRecs,
            questionsForUser,
            advertiser,
            advertiser_logo_url,
          };
        }
        return null;
      })
    );
    // Remove nulls and deduplicate
    const uniqueAds = Array.from(
      new Map(
        ads.filter(Boolean).map(a => [a!.headline.toLowerCase() + '|' + a!.ctaUrl, a!])
      ).values()
    );
    return c.json({
      ads: uniqueAds,
      condensedInput: input,
      ...qdrantData,
    }, qdrantResponse.status);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
