// Use OpenAI to extract a headline, CTA URL, images, and summary from adContext or payload
export async function extractAdDataWithAI(adContext: string | object, openaiApiKey: string): Promise<{ headline: string | null; ctaUrl: string | null; images: string[]; summary: string | null }> {
  const context = typeof adContext === 'string' ? adContext : JSON.stringify(adContext);
  const systemPrompt = `You are an expert at extracting marketing information from HTML and text. Given a context, extract:\n- headline: The most prominent or relevant headline (as plain text, not HTML).\n- ctaUrl: The first real call-to-action URL (must be a valid https?:// URL). If there are no valid URLs, use the placeholder PRX_CLICK_URL.\n- images: An array of all image URLs (src attributes) that are valid https?:// URLs.\n- summary: A concise, informational summary (1-2 sentences) of the content, in plain English. Do not mention that it is an ad or advertisement; just summarize the information presented.\nReturn a JSON object: { "headline": string | null, "ctaUrl": string | null, "images": string[], "summary": string | null }.`;

  const userPrompt = `Context:\n\n${context}\n\nExtract headline, ctaUrl, images, and summary as described.`;

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
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI extraction error:', await openaiResponse.text());
    return { headline: null, ctaUrl: null, images: [], summary: null };
  }

  const data = await openaiResponse.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      headline: typeof parsed.headline === 'string' ? parsed.headline : null,
      ctaUrl: typeof parsed.ctaUrl === 'string' ? parsed.ctaUrl : null,
      images: Array.isArray(parsed.images) ? parsed.images.filter((img: string) => typeof img === 'string') : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : null
    };
  } catch (e) {
    console.error('Failed to parse OpenAI extraction:', e, data);
    return { headline: null, ctaUrl: null, images: [], summary: null };
  }
}
