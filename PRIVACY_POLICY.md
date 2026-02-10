# Privacy Policy for "Is This True?"

Effective date: 2026-02-09

"Is This True?" is a browser extension that helps users fact-check selected text and images. This policy explains what information is processed when you use the extension.

## Information We Process

When you choose to run a fact-check, the extension processes only the content you explicitly submit:

- Selected text you choose to check.
- Image content for an image you choose to check (downloaded from the image URL and sent for analysis).

The extension does not require account creation and does not collect your name, email address, or payment information.

## How Information Is Used

Submitted content is sent to:

- Our API proxy hosted on Cloudflare Workers (`is-this-true-api.isittrue.workers.dev`), and
- Google Gemini API for analysis and fact-check response generation.

The content is used only to produce fact-check results and return them to your browser.

## Data Storage and Retention

The extension does not intentionally store your submitted text or images in persistent extension storage.

Operational logging or short-term processing may occur on third-party infrastructure (Cloudflare and Google) to deliver the service, secure systems, and troubleshoot reliability issues. Retention and handling on those services are governed by their own privacy terms.

## Data Sharing

We do not sell personal information.

We share submitted content only with the processors needed to provide the service:

- Cloudflare (API hosting/proxy)
- Google (Gemini API processing)

## Permissions

The extension requests browser permissions necessary to operate:

- Access to page content where you invoke checks (for selected text and images)
- Context menu integration (right-click actions)
- Scripting capabilities to display result UI on the current page

## Your Choices

- You control when data is sent by choosing to run a fact-check.
- If you do not want content processed, do not invoke the extension on that content.
- You can disable or uninstall the extension at any time.

## Children’s Privacy

This extension is not directed to children under 13, and we do not knowingly collect personal information from children.

## Security

We use HTTPS for network transmission between the extension, proxy service, and third-party AI provider.

## Changes to This Policy

We may update this policy from time to time. Updates will be posted at the same policy URL with a revised effective date.

## Contact

For privacy questions, contact:

- Email: DS9Design@gmail.com

