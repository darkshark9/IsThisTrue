# Is This True? API Worker

Cloudflare Worker that proxies fact-check (Gemini) and AI-image detection (SightEngine) so API keys stay server-side.

## Secrets

Set via Wrangler (after deploy):

- **GEMINI_API_KEY** – required for `/api/check` (text and image fact-check).
- **SIGHTENGINE_API_USER** and **SIGHTENGINE_API_SECRET** – required for `/api/check-ai-image` (AI-generated image detection). Get them at [SightEngine dashboard](https://dashboard.sightengine.com). Run:
  - `npx wrangler secret put SIGHTENGINE_API_USER`
  - `npx wrangler secret put SIGHTENGINE_API_SECRET`

## Deploy

```bash
npm run deploy
```

## Endpoints

- `POST /api/check` – body `{ type: "text"|"image", ... }` – fact-check using Gemini.
- `POST /api/check-ai-image` – body `{ imageUrl }` or `{ imageBase64 [, mimeType ] }` – AI-generated image detection using SightEngine.
