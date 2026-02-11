// ============================================================
// Is This True? - Cloudflare Worker Proxy
// Securely holds the Gemini API key and proxies requests
// ============================================================

const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// --- System Instruction (shared by text and image checks) ---

const SYSTEM_INSTRUCTION = `You are a rigorous, unbiased fact-checker. You have access to Google Search. You MUST use it to find the most recent and up-to-date information before making your assessment. Do not rely solely on your training data -- actively search the web for current facts, news, and sources relevant to the claim.

Before determining your verdict, you MUST follow these steps:

STEP 0 -- CLASSIFY THE TOPIC:
Determine whether the claim is "factual" (objective, verifiable with data), "political" (involves politicians, parties, policy, legislation, elections, or governance), "controversial" (a topic where reasonable people disagree based on values or interpretation), "scientific" (involves research, studies, health, or empirical data), "historical" (about past events), or "other". Set the topic_type field accordingly. This classification determines how you search for and weigh evidence.

STEP 1 -- IDENTIFY CLAIMS:
Identify every distinct factual claim being made. If the text contains multiple claims, evaluate each one individually.

STEP 2 -- SEARCH WITH SOURCE DIVERSITY:
Search the web for authoritative, up-to-date evidence for each claim. You MUST seek source diversity:
- For political or controversial topics: Actively search for perspectives from ACROSS the political spectrum. Do not rely only on the first results you find. Deliberately seek out how left-leaning sources, right-leaning sources, and centrist/nonpartisan sources each characterize the claim. For example, if checking a claim about a policy, search for coverage from outlets across the spectrum (e.g. AP/Reuters for center, then outlets known to lean left, and outlets known to lean right).
- For scientific topics: Prioritize peer-reviewed research and expert consensus, but also note credible dissenting views if they exist.
- For all topics: Include at least one nonpartisan or primary source (government data, official records, wire services) when available.

STEP 3 -- COMPARE AND WEIGH EVIDENCE:
Compare what you find against each claim, noting agreements, contradictions, and nuances. Consider the date and context of the claim -- something that was true in the past may not be true today, and vice versa. For time-sensitive claims (statistics, records, current office holders, ongoing events, etc.), always check the most recent data available. If the claim was accurate at one point but is now outdated, mark it as FALSE or PARTIALLY TRUE with an explanation of when it changed.

STEP 4 -- ANNOTATE YOUR SOURCES:
For every source you cite, you MUST identify:
- The source name (e.g. "Reuters", "CNN", "Fox News", "CBO", "Nature")
- The source's general political lean: "left", "center-left", "center", "center-right", "right", or "nonpartisan". Use "nonpartisan" for wire services (AP, Reuters, AFP), government agencies, academic journals, and official data repositories. Be honest and accurate about source leans based on widely accepted media bias assessments.
Do NOT include URLs in the sources array. URLs are provided separately by the grounding system. Only provide the source name and its political lean.
Prefer sources that come directly from your web-grounding/search results for this check. Do not invent outlets that were not part of your evidence collection.
The number of sources MUST scale with topic complexity:
- Simple single-claim checks with strong consensus: 3-5 sources
- Standard claims: 5-7 sources
- Complex, multi-claim, controversial, or heavily disputed topics: 8-10 sources
Keep sources meaningfully distinct (not duplicate outlet variants), and include a balanced mix when the topic is political/controversial.

STEP 5 -- PROVIDE BALANCED PERSPECTIVES (for political/controversial topics):
If the topic_type is "political" or "controversial", you MUST fill in the "perspectives" array. Each entry should have a "side" label (e.g. "Conservative view", "Progressive view", "Proponents", "Critics") and a "summary" of what that side argues with supporting evidence. Aim for 2-4 distinct perspectives. Be fair and thorough -- do not strawman any side. Each summary should be concise (2-4 sentences). For non-political/non-controversial topics, set perspectives to null.

STEP 6 -- REASON AND CONCLUDE:
In your "reasoning" field, show your step-by-step work: which claims you identified, what evidence you found for each from which sources, and how you weighed the evidence. Only then assign a verdict and confidence score.

MULTI-CLAIM RULES:
If the text contains multiple distinct claims, your overall verdict should reflect ALL of them:
- If all claims are true, verdict is TRUE.
- If all claims are false, verdict is FALSE.
- If some are true and some are false, or any claim is only partially accurate, verdict is PARTIALLY TRUE.
- If you cannot find sufficient evidence, verdict is UNVERIFIABLE.
In your details, address each claim individually so the user understands which parts are accurate and which are not.

CONFIDENCE SCORING:
Your confidence score MUST reflect how well-sourced your evidence is:
- 90-100: Multiple authoritative sources confirm or deny the claim with strong agreement
- 70-89: Good evidence from reliable sources, but minor ambiguity remains
- 50-69: Mixed or limited evidence, sources partially disagree
- 30-49: Mostly indirect or weak evidence
- 0-29: Very little evidence found, essentially a guess

Do NOT default to high confidence. If evidence is thin, your confidence should be low even if you lean toward a verdict.

Before outputting confidence, explicitly evaluate:
1) number of independent sources,
2) source quality (primary/nonpartisan vs opinion/secondary),
3) source agreement vs conflict,
4) recency for time-sensitive claims,
5) whether key facts remain unknown.

Scoring constraints:
- 95+ is rare and requires very strong, recent, multi-source agreement from high-quality sources.
- If evidence is mixed, confidence should usually stay in the 70-85 range.
- If verdict is UNVERIFIABLE, confidence should usually be 60-78 (not near-certain).
- Avoid using the same confidence number repeatedly across unrelated checks.`;

// --- User Prompts (lean -- role & format handled by system instruction + schema) ---

const TEXT_PROMPT = (text) => `Analyze the following claim or statement and determine whether it is true, false, partially true, or unverifiable.

CLAIM TO ANALYZE:
"""
${text}
"""`;

const IMAGE_PROMPT = `Analyze the attached image carefully. Look for any claims, text, statistics, quotes, memes, headlines, or visual information that can be fact-checked.

If the image contains text or claims, evaluate their truthfulness. If it is a meme or infographic, assess the accuracy of the information presented. If it is a photo, assess whether it appears authentic or manipulated, and whether any captions or overlaid text are accurate.`;

// --- Shared Gemini Configuration ---

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reasoning: {
      type: "string",
      description: "Step-by-step reasoning: list each claim identified, evidence found from which sources, and how you weighed it."
    },
    topic_type: {
      type: "string",
      enum: ["factual", "political", "controversial", "scientific", "historical", "other"],
      description: "Classification of the claim's topic area."
    },
    verdict: {
      type: "string",
      enum: ["TRUE", "FALSE", "PARTIALLY TRUE", "UNVERIFIABLE"]
    },
    confidence: {
      type: "integer",
      description: "0-100 confidence score based on strength of evidence."
    },
    summary: {
      type: "string",
      description: "One-sentence summary of the finding."
    },
    details: {
      type: "string",
      description: "Detailed explanation with reasoning, evidence, and context. Use newlines to separate paragraphs. For multiple claims, start each with a bold header on its own line (e.g. **Claim 1: [claim text]**) followed by your analysis. Use numbered lists (1. item) or bullet points (- item) where helpful for readability."
    },
    perspectives: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        properties: {
          side: {
            type: "string",
            description: "Short label for this viewpoint (e.g. 'Conservative view', 'Progressive view', 'Proponents', 'Critics', 'Industry position', 'Public health view')."
          },
          summary: {
            type: "string",
            description: "What this side argues and what evidence supports their position. Be fair, concise, and specific."
          }
        },
        required: ["side", "summary"]
      },
      description: "For political or controversial topics: an array of distinct viewpoints, each with a label and summary. Null for non-political/non-controversial topics. Aim for 2-4 perspectives."
    },
    corrections: {
      type: "string",
      nullable: true,
      description: "If false or partially true, provide the correct information. Otherwise null."
    },
    sources: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the source (e.g. 'Reuters', 'Fox News', 'CNN', 'CBO'). Do NOT include URLs." },
          lean: {
            type: "string",
            enum: ["left", "center-left", "center", "center-right", "right", "nonpartisan"],
            description: "Political lean of the source based on widely accepted media bias assessments."
          }
        },
        required: ["name", "lean"]
      },
      description: "Annotated sources used to verify the claim. Only provide source name and lean -- URLs are supplied by the grounding system."
    }
  },
  required: ["reasoning", "topic_type", "verdict", "confidence", "summary", "details", "sources"]
};

const GENERATION_CONFIG = {
  temperature: 0.1,
  topP: 0.8,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  responseSchema: RESPONSE_SCHEMA,
};

// --- Main Handler ---

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only allow POST
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Validate the API key secret is configured
    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: "Server misconfigured: missing API key" }, 500);
    }

    // Parse the request
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/check") {
      return handleCheck(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};

// --- /api/check Handler ---

async function handleCheck(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { type } = body;

  try {
    if (type === "text") {
      return await handleTextCheck(body, env);
    } else if (type === "image") {
      return await handleImageCheck(body, env);
    } else {
      return jsonResponse({ error: 'Invalid type. Must be "text" or "image".' }, 400);
    }
  } catch (err) {
    const status = err instanceof WorkerError ? err.status : 500;
    return jsonResponse({ error: err.message || "Internal server error" }, status);
  }
}

// --- Text Check ---

async function handleTextCheck(body, env) {
  const { text } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return jsonResponse({ error: "Missing or empty 'text' field" }, 400);
  }

  // Limit text length to prevent abuse
  if (text.length > 10000) {
    return jsonResponse({ error: "Text too long (max 10,000 characters)" }, 400);
  }

  const geminiBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [{
      parts: [{ text: TEXT_PROMPT(text) }]
    }],
    tools: [{ googleSearch: {} }],
    generationConfig: GENERATION_CONFIG,
  };

  return callGemini(geminiBody, env);
}

// --- Image Check ---

const IMAGE_FETCH_TIMEOUT_MS = 30_000;
const MAX_IMAGE_SIZE_BYTES = 12 * 1024 * 1024; // 12MB

async function handleImageCheck(body, env) {
  // Accept either an image URL (preferred) or legacy base64 payload
  const { imageUrl, imageBase64, mimeType } = body;

  let finalBase64;
  let finalMimeType;

  if (imageUrl && typeof imageUrl === "string") {
    // Fetch the image server-side (no CORS restrictions on the worker)
    const imageData = await fetchImageAsBase64(imageUrl);
    finalBase64 = imageData.base64;
    finalMimeType = imageData.mimeType;
  } else if (imageBase64 && typeof imageBase64 === "string") {
    // Legacy path: base64 sent directly from the extension
    if (!mimeType || typeof mimeType !== "string") {
      return jsonResponse({ error: "Missing 'mimeType' field" }, 400);
    }
    if (imageBase64.length > 14_000_000) {
      return jsonResponse({ error: "Image too large (max ~10MB)" }, 400);
    }
    finalBase64 = imageBase64;
    finalMimeType = mimeType;
  } else {
    return jsonResponse({ error: "Missing 'imageUrl' or 'imageBase64' field" }, 400);
  }

  const geminiBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [{
      parts: [
        { text: IMAGE_PROMPT },
        {
          inlineData: {
            mimeType: finalMimeType,
            data: finalBase64,
          },
        },
      ],
    }],
    tools: [{ googleSearch: {} }],
    generationConfig: GENERATION_CONFIG,
  };

  return callGemini(geminiBody, env);
}

// --- Image Fetching (server-side) ---

async function fetchImageAsBase64(imageUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(imageUrl, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new WorkerError(`Timed out downloading image (${Math.round(IMAGE_FETCH_TIMEOUT_MS / 1000)}s)`, 504);
    }
    throw new WorkerError(`Failed to download image: ${err.message}`, 502);
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new WorkerError(`Image source returned HTTP ${response.status}`, 502);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const mimeType = contentType.split(";")[0].trim();
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = Math.round(arrayBuffer.byteLength / (1024 * 1024));
    const maxMB = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
    throw new WorkerError(`Image is too large (${sizeMB}MB). Max is ${maxMB}MB.`, 400);
  }

  // Convert to base64
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  return { base64, mimeType };
}

// Simple error class that carries an HTTP status code
class WorkerError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

// --- Gemini API Call ---

async function callGemini(geminiBody, env) {
  const apiUrl = `${GEMINI_URL}?key=${env.GEMINI_API_KEY}`;

  let geminiResponse;
  try {
    geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch (err) {
    return jsonResponse({ error: "Failed to reach Gemini API" }, 502);
  }

  if (!geminiResponse.ok) {
    const errBody = await geminiResponse.json().catch(() => ({}));
    const msg = errBody.error?.message || `Gemini API error (${geminiResponse.status})`;
    return jsonResponse({ error: msg }, geminiResponse.status);
  }

  const data = await geminiResponse.json();

  // Concatenate all text parts (grounding can split response across multiple parts)
  const parts = data.candidates?.[0]?.content?.parts || [];
  const responseText = parts
    .filter(p => p.text)
    .map(p => p.text)
    .join("") || "";

  // Extract grounding metadata (web search sources) if available
  const groundingMetadata = data.candidates?.[0]?.groundingMetadata || null;
  const searchSuggestion = groundingMetadata?.searchEntryPoint?.renderedContent || null;
  const groundingSources = groundingMetadata?.groundingChunks?.map(chunk => ({
    title: chunk.web?.title || "",
    url: chunk.web?.uri || ""
  })).filter(s => s.url) || [];

  return jsonResponse({
    response: responseText,
    groundingSources,
    searchSuggestion
  });
}

// --- Helpers ---

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}
