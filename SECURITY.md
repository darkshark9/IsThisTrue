# Security and credential practices

This project follows security best practices for API keys and credentials, including those recommended by Google Cloud.

## Zero-code storage (no keys in source)

- **API keys and secrets are never committed to source or version control.**
- The Gemini API key is used only in the Cloudflare Worker and is **injected at runtime** via [Wrangler secrets](https://developers.cloudflare.com/workers/configuration/secrets/):
  - Set the key after deploy: `npx wrangler secret put GEMINI_API_KEY` (from the `worker/` directory).
  - The key is stored encrypted by Cloudflare and is not present in this repository or in `wrangler.toml`.
- The browser extension and Electron app never see the API key; they call the public worker endpoint only.

## Google Cloud / API key hygiene (your responsibility in GCP Console)

If your Gemini API key is created in Google Cloud (APIs & Services > Credentials), we recommend:

1. **Enforce API restrictions** – Restrict the key to only the APIs it needs (e.g. Generative Language API). Do not leave keys unrestricted.
2. **Apply application restrictions** – Use HTTP referrers, IP addresses, or bundle IDs as appropriate so the key cannot be used from unexpected environments.
3. **Disable dormant keys** – In GCP, audit and remove or disable keys with no use in the last 30 days.
4. **Least privilege** – Use a dedicated key or service account for this app with only the minimum required permissions.
5. **Key rotation** – Rotate the key periodically. After creating a new key in GCP, update the Worker secret with `npx wrangler secret put GEMINI_API_KEY`, then disable or delete the old key.
6. **Essential Contacts** – In Google Cloud Console, ensure Essential Contacts are set so security and billing notifications reach the right people.
7. **Billing and budget alerts** – Configure billing anomaly and budget alerts and act on them; usage spikes can indicate compromised credentials.

## Local development

- Do not add `.env` or any file containing real API keys to the repository. `.env` and similar patterns are listed in `.gitignore`.
- For local Worker development, use `wrangler secret put GEMINI_API_KEY` in the `worker/` directory so the key is stored in your local Wrangler config (not in the repo).
