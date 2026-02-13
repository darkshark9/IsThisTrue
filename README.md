# Is This True?

`Is This True?` helps you quickly fact-check text and images you see online.

It is built for people who want a fast, readable answer with source-backed context, not just a one-line AI opinion.

## Robust Analysis by Design

**Is This True? is designed to deliver more than a quick AI guess.**  
Each check follows a structured verification flow intended to increase reliability and reduce one-sided conclusions:

- Breaks a claim into checkable parts so complex statements are not oversimplified.
- Uses real-time web-grounded verification rather than relying only on model memory.
- Cross-references multiple source perspectives for broader coverage.
- Weighs recency and source quality before returning a verdict.
- Surfaces confidence, reasoning, and references so results are transparent.

For political and controversial topics, it is intentionally built to include multiple viewpoints to better reflect real-world disagreement.

## What You Can Do

- Highlight a claim on any webpage and check it instantly.
- Right-click an image, meme, or infographic to **fact-check** it, or choose **Is This AI?** to check if the image is AI-generated.
- See a clear verdict:
  - `TRUE`
  - `FALSE`
  - `PARTIALLY TRUE`
  - `UNVERIFIABLE`
- Review confidence, summary, and deeper reasoning in one panel.

### Desktop app (Electron)

The desktop app uses the same API worker and adds:

- **Fact-check (image or text)**: press **Ctrl+Shift+X** (Mac: **Cmd+Shift+X**), then drag to snip a region. The overlay shows fact-check results (verdict, sources, reasoning).
- **AI-generated image check**: press **Ctrl+Shift+A** (Mac: **Cmd+Shift+A**), then drag to snip a region. The overlay shows whether the image is likely AI-generated or human-made (SightEngine). No fact-check is run in this mode.

Both flows use the same snipping UI; the hotkey you press decides which check runs after you release the selection.

## How It Works

When you run a check, the extension:

1. Analyzes the claim or image content.
2. Cross-checks with real-time web information.
3. Compares evidence from multiple sources.
4. Returns a structured result with reasoning and references.

For political or controversial claims, it is designed to surface multiple viewpoints so results are not one-sided.

## Why People Use It

- Saves time when claims are vague, emotional, or fast-moving.
- Makes it easier to spot missing context and misleading framing.
- Shows reasoning and sources so you can judge the result yourself.
- Works directly on the page you are already reading.

## Accuracy and Limitations

`Is This True?` is designed for high reliability, but no automated checker is perfect.

- Treat results as decision support, not absolute truth.
- For high-stakes decisions (health, legal, financial, safety), always verify with primary sources and qualified experts.
- Breaking news and developing events can change quickly, which may affect outcomes.

## Privacy

To generate results, the extension processes only content you choose to check (selected text or selected image content).

Read the full policy in `PRIVACY_POLICY.md`.

## API worker and AI-image detection

The Cloudflare Worker (`worker/`) proxies fact-check (Gemini) and, optionally, AI-generated image detection (SightEngine). To enable the desktop **Ctrl+Shift+A** AI check, set SightEngine secrets as described in `worker/README.md`.
