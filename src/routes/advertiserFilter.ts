import { HonoContext } from 'hono';

// POST /advertiser-filter
// Body: { advertiser_id: string|number, limit?: number, with_payload?: boolean|array, with_vector?: boolean, additional_filter?: any[], collection_name?: string }
export async function handleAdvertiserFilterEndpoint(c: HonoContext<any, any, any>) {
  const env = c.env;
  // Default collection name (adjust as needed)
  const defaultCollection = 'content_requests';
  const qdrantBaseUrl = 'https://9069ee8d-d87c-4e0e-8461-c9e2583acdcc.us-west-1-0.aws.cloud.qdrant.io:6333';

  try {
    const body = await c.req.json();
    const {
      advertiser_id,
      limit = 15,
      with_payload = true,
      with_vector = false,
      additional_filter = [],
      collection_name = defaultCollection,
      order_by = { key: 'created', direction: 'desc' }, // allow override, but default to created desc
    } = body;

    if (!advertiser_id) {
      return c.json({ error: 'Missing advertiser_id' }, 400);
    }

    // Build the Qdrant filter
    const filter = {
      must: [
        { key: 'advertiser_id', match: { value: advertiser_id } },
        ...additional_filter,
      ],
    };

    // Build the Qdrant scroll request body
    const qdrantBody: any = {
      with_payload,
      filter,
      limit,
      with_vector,
      order_by, // always include order_by
    };

    // Qdrant scroll endpoint
    const qdrantUrl = `${qdrantBaseUrl}/collections/${collection_name}/points/scroll`;

    // Forward the request to Qdrant
    const qdrantResp = await fetch(qdrantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.QDRANT_API_KEY,
      },
      body: JSON.stringify(qdrantBody),
    });

    const data = await qdrantResp.json();
    return c.json(data, qdrantResp.status);
  } catch (error) {
    console.error('Error in /advertiser-filter:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
