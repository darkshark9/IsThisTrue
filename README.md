##Download the latest version here:
https://github.com/darkshark9/IsThisTrue/releases


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

## Distribution & releases

The Windows installer bundles the Electron desktop app AND auto-registers the Chrome extension via Chrome's `ExtensionInstallForcelist` policy. The extension is hosted from this repo's GitHub Pages site and auto-updates from there.

### One-time setup (already done)

- `extension-key.pem` — RSA-2048 signing key. **Never commit. Back up to a password manager.** Loss of this key means you can never publish updates for the existing extension ID.
- Extension ID: `kpjclcnjdlghkbhajcpdiabpbceedhdk` (derived from the public key, permanent).
- GitHub Pages serves from `main` branch, `/docs` folder. The auto-update manifest is at `https://darkshark9.github.io/IsThisTrue/update.xml`.
- Repo secret `EXTENSION_KEY_PEM` holds the PEM contents for CI signing.

### Cutting a release (both extension + installer)

Double-click [`release.bat`](release.bat) (or `release.bat 1.0.6` from a terminal). The script:

1. Bumps `version` in [`manifest.json`](manifest.json) and [`electron-app/package.json`](electron-app/package.json).
2. Commits, tags `vX.Y.Z`, and pushes the commit + tag.
3. CI takes over:
   - [`Build & publish Chrome extension CRX`](.github/workflows/release-extension.yml) packs the new `.crx`, regenerates `docs/update.xml`, commits both to `main`. Within a few hours every installed Chrome polls `update.xml` and self-updates.
   - `Build/Release` builds the Windows `.exe` and macOS `.dmg` and attaches them to a [GitHub Release](https://github.com/darkshark9/IsThisTrue/releases) named after the tag.

For an extension-only update (no new installer): bump `manifest.json` only and push to `main` — the CRX workflow runs, the installer workflow doesn't.

To build locally without releasing:

```sh
npm install            # one-time
npm run build:crx      # writes docs/extension/is-this-true-X.Y.Z.crx + docs/update.xml
npm run extension-id   # prints the extension ID derived from extension-key.pem
```

### How the registry hook works

On install, [`electron-app/installer.nsh`](electron-app/installer.nsh) writes:

```
HKCU\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist
  "942" = "kpjclcnjdlghkbhajcpdiabpbceedhdk;https://darkshark9.github.io/IsThisTrue/update.xml"
```

(plus the equivalent under `Policies\Chromium` for Edge/Brave). HKCU avoids the UAC prompt and applies to the installing user. Chrome installs the extension on next launch and shows "Managed by your organization" — expected behavior for any policy-installed extension. Uninstall removes the registry value.
