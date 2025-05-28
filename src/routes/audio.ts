import { HonoContext } from 'hono';

// Helper: Generate an engaging headline from headlines[] and user input
async function generateEngagingHeadline(headlines: string[], userInput: string, openaiApiKey: string): Promise<string> {
  if (!headlines || headlines.length === 0) return '';
  const systemPrompt = `You are an expert copywriter. Given a list of possible ad headlines and a user search query, select or rewrite the most engaging, relevant headline for the user. Prefer the most compelling, clear, and relevant headline, or combine elements if needed. Return only the final headline as plain text.`;
  const userPrompt = `User query: ${userInput}\n\nHeadlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\nBest headline:`;
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
      temperature: 0.2,
      max_tokens: 100,
      response_format: { type: 'text' }
    })
  });
  if (!openaiResponse.ok) {
    console.error('OpenAI headline generation error:', await openaiResponse.text());
    return headlines[0];
  }
  const data = await openaiResponse.json();
  return data.choices?.[0]?.message?.content?.trim() || headlines[0];
}

// Helper: Generate a 15-second audio ad script
async function generateAudioAdScript(payload: any, userInput: string, openaiApiKey: string): Promise<string> {
  const systemPrompt = `You are an expert audio ad copywriter. Given the following ad data and a user search query, write a compelling, brand-safe, 15-second audio ad script. Use a conversational, energetic tone. Mention the product, its main benefit, and a call to action. Do not mention that this is an ad. Return only the script as plain text.`;
  const userPrompt = `User query: ${userInput}\n\nAd data (JSON):\n${JSON.stringify(payload, null, 2)}\n\n15-second audio ad script:`;
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
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'text' }
    })
  });
  if (!openaiResponse.ok) {
    console.error('OpenAI audio ad script error:', await openaiResponse.text());
    return '';
  }
  const data = await openaiResponse.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function handleAudioEndpoint(c: HonoContext<any, any, any>) {
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
    // Only fetch one point
    const qdrantResponse = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.QDRANT_API_KEY,
      },
      body: JSON.stringify({ ...qdrantParams, query: embedding, with_payload, limit: 1 }),
    });
    if (!qdrantResponse.ok) {
      const error = await qdrantResponse.json();
      console.error('Error from Qdrant API:', error);
      return c.json({ error: 'Failed to query Qdrant API' }, 500);
    }
    const qdrantData = await qdrantResponse.json();
    const point = qdrantData?.result?.points?.[0];
    if (!point || !point.payload) {
      return c.json({ ads: [], condensedInput: input, ...qdrantData }, qdrantResponse.status);
    }
    const payload = point.payload;
    // Use preview_image_urls for images, target_url for ctaUrl, and generate engaging headline
    const images = Array.isArray(payload.preview_image_urls) ? payload.preview_image_urls : [];
    const ctaUrl = payload.target_url || null;
    const headlines = Array.isArray(payload.headlines) ? payload.headlines : [];
    const engagingHeadline = await generateEngagingHeadline(headlines, input, env.OPENAI_API_KEY);
    const audioAdScript = await generateAudioAdScript(payload, input, env.OPENAI_API_KEY);
    const advertiser = payload.advertiser || null;
    const advertiser_logo_url = payload.advertiser_logo_url || null;
    const summary = payload.preview_text || null;
    let ad = null;
    if (engagingHeadline && engagingHeadline.trim()) {
      ad = {
        headline: engagingHeadline.trim(),
        ctaUrl: ctaUrl ? ctaUrl.trim() : null,
        images,
        summary,
        audioAdScript,
        advertiser,
        advertiser_logo_url,
      };
    }
    return c.json({
      ads: ad ? [ad] : [],
      condensedInput: input,
      ...qdrantData,
    }, qdrantResponse.status);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
