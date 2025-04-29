# Creative Search for AI API

## 🚀 Next-Gen Semantic Search for Ads, Content, and More

**Creative Search for AI** is a blazing-fast, AI-powered API for semantic search and retrieval, built on top of OpenAI embeddings and the Qdrant vector database. Instantly find the most relevant ads, content, or documents for any user query—no keywords required.

---

## 🌟 Why Choose Creative Search for AI?
- **AI-Driven Relevance:** Uses OpenAI's latest embedding models for deep semantic understanding.
- **Lightning Fast:** Built on Cloudflare Workers and Qdrant for ultra-low latency.
- **Plug & Play:** Simple HTTP API—no infrastructure or ML expertise needed.
- **Rich Results:** Extracts headlines, summaries, images, and CTAs from your data.
- **Scalable:** Handles millions of records and high QPS with ease.

---

## 🔥 Featured Endpoint: `/api/query`

### POST `/api/query`

Submit a natural language query and get the most relevant results from your indexed content, powered by OpenAI embeddings and Qdrant.

#### Request Body
```json
{
  "input": "string (required) - Your search query or text",
  "filter": { "...": "Qdrant filter object (optional)" },
  "limit": 10,
  "offset": 0
}
```

#### Example Request
```bash
curl -X POST https://creative-search-for-ai1.p.rapidapi.com/api/query \
  -H "Content-Type: application/json" \
  -H "X-RapidAPI-Key: <YOUR_RAPIDAPI_KEY>" \
  -d '{
    "input": "vitamix blender for smoothies",
    "limit": 5
  }'
```

#### Example Response
```json
{
  "result": {
    "points": [
      {
        "id": 123,
        "score": 0.98,
        "payload": {
          "headline": "Blend Like a Pro with Vitamix",
          "summary": "Discover the power of Vitamix for perfect smoothies every time.",
          "ctaUrl": "https://shop.vitamix.com/blenders",
          "images": ["https://cdn.example.com/vitamix.jpg"],
          "advertiser": "Vitamix"
        }
      }
    ]
  },
  "status": "ok",
  "time": 0.12
}
```

---

## 💡 Use Cases
- **AdTech:** Match users to the most relevant ads in real time.
- **E-commerce:** Power semantic product search and recommendations.
- **Content Discovery:** Surface the best articles, videos, or offers for any query.
- **Chatbots & Agents:** Instantly retrieve knowledge snippets for conversational AI.

---

## 🛠️ How It Works
1. **Send a POST request to `/api/query`** with your search text.
2. **The API generates an OpenAI embedding** for your query.
3. **Qdrant vector search** finds the most relevant content.
4. **Rich payload extraction**: Get headlines, summaries, images, and CTAs in the response.

---

## ⚡ Try It Now
- **Base URL:** `https://creative-search-for-ai1.p.rapidapi.com`
- **Endpoint:** `POST /api/query`
- **Requires RapidAPI Key** (get yours from the RapidAPI marketplace)

---

## 📈 Why Buy?
- **Increase engagement** with smarter, more relevant results
- **Reduce bounce rates** by matching users to what they want
- **Easy integration**—just one API call
- **Battle-tested infrastructure** (Cloudflare, Qdrant, OpenAI)

---

## 📝 Contact & Support
- For onboarding, custom plans, or support, contact [WebsyteAI](mailto:support@websyte.ai)
- [View source & docs](https://github.com/WebsyteAI/ntv-creative-search)

---

**Creative Search for AI**: The fastest way to add AI-powered semantic search to your app, site, or workflow.
