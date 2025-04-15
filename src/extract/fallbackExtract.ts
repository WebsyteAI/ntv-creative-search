// Fallback extraction for headline, ctaUrl, images, and summary from adContext
export function fallbackExtract(adContext: string): { headline: string | null, ctaUrl: string | null, images: string[], summary: string | null } {
  // Headline: first non-empty line from [Headlines] section
  let headline: string | null = null;
  const headlineMatch = adContext.match(/\[Headlines\]\s*([\s\S]*?)(?:\n\n|\[Page Content\])/);
  if (headlineMatch && headlineMatch[1]) {
    const lines = headlineMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) headline = lines[0];
  }

  // ctaUrl: first valid https?:// URL in href, else PRX_CLICK_URL
  let ctaUrl: string | null = null;
  const urlRegex = /href="(https?:\/\/[^\"]+)"/gi;
  const urlMatch = urlRegex.exec(adContext);
  if (urlMatch && urlMatch[1]) ctaUrl = urlMatch[1];
  if (!ctaUrl) ctaUrl = "PRX_CLICK_URL";

  // images: all <img src="...">, handle protocol-relative URLs
  const images: string[] = [];
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(adContext)) !== null) {
    let src = imgMatch[1];
    if (src.startsWith('//')) src = 'https:' + src;
    if (/^https?:\/\//.test(src)) images.push(src);
  }

  // summary: fallback to first 1-2 sentences from [Page Content] or the first paragraph
  let summary: string | null = null;
  const pageContentMatch = adContext.match(/\[Page Content\]([\s\S]*)/);
  if (pageContentMatch && pageContentMatch[1]) {
    // Remove HTML tags
    let text = pageContentMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Get first 2 sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
      summary = sentences.slice(0, 2).join(' ').trim();
    } else if (text.length > 0) {
      summary = text.slice(0, 200).trim();
    }
  }
  return { headline, ctaUrl, images, summary };
}
