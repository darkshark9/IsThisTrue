// ============================================================
// Is This True? - Background Service Worker
// Sends requests to Cloudflare Worker proxy for fact-checking
// ============================================================

const WORKER_URL = "https://is-this-true-api.isittrue.workers.dev";
const WORKER_TIMEOUT_MS = 90000;

function createRequestId(type) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logInfo(requestId, message, extra) {
  if (typeof extra !== "undefined") {
    console.log(`[IsThisTrue][${requestId}] ${message}`, extra);
    return;
  }
  console.log(`[IsThisTrue][${requestId}] ${message}`);
}

function logWarn(requestId, message, extra) {
  if (typeof extra !== "undefined") {
    console.warn(`[IsThisTrue][${requestId}] ${message}`, extra);
    return;
  }
  console.warn(`[IsThisTrue][${requestId}] ${message}`);
}

function logError(requestId, message, error) {
  if (error) {
    console.error(`[IsThisTrue][${requestId}] ${message}`, error);
    return;
  }
  console.error(`[IsThisTrue][${requestId}] ${message}`);
}

// --- AllSides Media Bias Ratings ---
// Source: allsides.com -- used to override the model's lean classification
// with AllSides' editorial ratings when a known source is cited.
// Keys are normalized (lowercase, leading "the" removed).
// Ratings should be reviewed periodically as AllSides updates them.

const ALLSIDES_RATINGS = {
  // --- Left ---
  "msnbc": "left",
  "cnn": "left",
  "cnn news": "left",
  "vox": "left",
  "vox media": "left",
  "huffpost": "left",
  "huffington post": "left",
  "mother jones": "left",
  "jacobin": "left",
  "nation": "left",
  "democracy now": "left",
  "democracy now!": "left",
  "daily kos": "left",
  "salon": "left",
  "intercept": "left",
  "slate": "left",
  "buzzfeed news": "left",
  "buzzfeed": "left",
  "new republic": "left",
  "young turks": "left",
  "tyt": "left",
  "occupy democrats": "left",
  "raw story": "left",
  "alternet": "left",
  "daily beast": "left",
  "palmer report": "left",
  "msnbc news": "left",
  "second nexus": "left",
  "partisan girl": "left",

  // --- Lean Left ---
  "new york times": "center-left",
  "nyt": "center-left",
  "washington post": "center-left",
  "wapo": "center-left",
  "npr": "center-left",
  "national public radio": "center-left",
  "cbs news": "center-left",
  "cbs": "center-left",
  "nbc news": "center-left",
  "abc news": "center-left",
  "guardian": "center-left",
  "politico": "center-left",
  "bloomberg": "center-left",
  "bloomberg news": "center-left",
  "atlantic": "center-left",
  "time": "center-left",
  "time magazine": "center-left",
  "usa today": "center-left",
  "pbs": "center-left",
  "pbs newshour": "center-left",
  "axios": "center-left",
  "propublica": "center-left",
  "business insider": "center-left",
  "insider": "center-left",
  "independent": "center-left",
  "economist": "center-left",
  "vice": "center-left",
  "vice news": "center-left",
  "los angeles times": "center-left",
  "la times": "center-left",
  "new yorker": "center-left",
  "newsweek": "center-left",
  "ap news": "center",        // Note: AP is center, listed here to catch "AP News" variant

  // --- Center ---
  "associated press": "center",
  "ap": "center",
  "reuters": "center",
  "wall street journal": "center",
  "wsj": "center",
  "hill": "center",
  "realclearpolitics": "center",
  "rcp": "center",
  "forbes": "center",
  "c-span": "center",
  "cspan": "center",
  "christian science monitor": "center",
  "bbc": "center",
  "bbc news": "center",
  "marketwatch": "center",
  "allsides": "center",
  "ground news": "center",
  "just the news": "center",

  // --- Lean Right ---
  "new york post": "center-right",
  "ny post": "center-right",
  "washington times": "center-right",
  "washington examiner": "center-right",
  "dispatch": "center-right",
  "reason": "center-right",
  "reason magazine": "center-right",
  "free press": "center-right",
  "spectator": "center-right",

  // --- Right ---
  "fox news": "right",
  "fox": "right",
  "breitbart": "right",
  "breitbart news": "right",
  "daily wire": "right",
  "daily caller": "right",
  "newsmax": "right",
  "one america news": "right",
  "one america news network": "right",
  "oan": "right",
  "oann": "right",
  "blaze": "right",
  "theblaze": "right",
  "blaze media": "right",
  "epoch times": "right",
  "federalist": "right",
  "gateway pundit": "right",
  "national review": "right",
  "townhall": "right",
  "american conservative": "right",
  "washington free beacon": "right",
  "prageru": "right",
  "prager university": "right",
  "new york sun": "right",
  "ben shapiro": "right",
};

// Normalize a source name for AllSides lookup:
// lowercase, trim, strip leading "the ", collapse whitespace.
function normalizeSourceName(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ");
}

// Override source lean values with AllSides ratings when available.
// Adds an `allsidesRated` boolean to each source object.
function applyAllSidesRatings(sources) {
  if (!Array.isArray(sources)) return sources;

  return sources.map(src => {
    if (!src || typeof src !== "object" || !src.name) return src;

    const normalized = normalizeSourceName(src.name);
    const rating = ALLSIDES_RATINGS[normalized];

    if (rating) {
      return { ...src, lean: rating, allsidesRated: true };
    }
    return { ...src, allsidesRated: false };
  });
}

function extractHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getRootDomain(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) return hostname;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

function titleToSourceName(title = "") {
  const trimmed = String(title || "").trim();
  if (!trimmed) return "";
  const segments = trimmed.split(/\s+[-|:]\s+/).filter(Boolean);
  return (segments[segments.length - 1] || trimmed).trim();
}

function domainToSourceName(hostname) {
  const host = (hostname || "").toLowerCase();
  if (!host) return "";

  const knownDomains = [
    ["reuters.com", "Reuters"],
    ["apnews.com", "AP News"],
    ["nytimes.com", "New York Times"],
    ["washingtonpost.com", "Washington Post"],
    ["wsj.com", "Wall Street Journal"],
    ["foxnews.com", "Fox News"],
    ["cnn.com", "CNN"],
    ["bbc.com", "BBC"],
    ["bbc.co.uk", "BBC"],
    ["theguardian.com", "The Guardian"],
    ["npr.org", "NPR"],
    ["politico.com", "Politico"],
    ["axios.com", "Axios"],
    ["newsmax.com", "Newsmax"],
    ["breitbart.com", "Breitbart"],
    ["dailywire.com", "Daily Wire"],
    ["huffpost.com", "HuffPost"],
    ["msnbc.com", "MSNBC"],
    ["usatoday.com", "USA Today"],
    ["economist.com", "The Economist"],
    ["cbsnews.com", "CBS News"],
    ["nbcnews.com", "NBC News"],
    ["abcnews.go.com", "ABC News"],
    ["forbes.com", "Forbes"],
    ["marketwatch.com", "MarketWatch"],
    ["propublica.org", "ProPublica"],
    ["nature.com", "Nature"],
    ["science.org", "Science"]
  ];

  for (const [needle, label] of knownDomains) {
    if (host === needle || host.endsWith(`.${needle}`)) {
      return label;
    }
  }

  const root = getRootDomain(host);
  if (!root) return "";
  const base = root.split(".")[0] || root;
  return base.replace(/[-_]/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
}

function inferLeanFromHostname(hostname) {
  const host = (hostname || "").toLowerCase();
  if (!host) return "center";
  if (host.endsWith(".gov") || host.endsWith(".edu")) return "nonpartisan";
  if (host.includes("reuters.com") || host.includes("apnews.com")) return "nonpartisan";
  if (host.includes("who.int") || host.includes("cdc.gov") || host.includes("nih.gov")) return "nonpartisan";

  const inferredName = domainToSourceName(host);
  const rating = ALLSIDES_RATINGS[normalizeSourceName(inferredName)];
  return rating || "center";
}

function buildGroundingAnnotatedSources(groundingSources) {
  if (!Array.isArray(groundingSources)) return [];
  const output = [];
  const seen = new Set();

  for (const src of groundingSources) {
    const url = String(src?.url || "").trim();
    if (!url) continue;
    if (url.includes("vertexaisearch.cloud.google.com")) continue;
    if (url.includes("googleapis.com/grounding")) continue;

    const hostname = extractHostname(url);
    const name = titleToSourceName(src?.title || "") || domainToSourceName(hostname);
    if (!name) continue;

    const key = normalizeSourceName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    output.push({
      name,
      lean: inferLeanFromHostname(hostname)
    });
  }

  return output;
}

function mergeSourcesWithGrounding(modelSources, groundingSources, maxSources = 10) {
  const merged = [];
  const seen = new Set();

  const add = (src) => {
    if (!src || typeof src !== "object" || !src.name) return;
    const key = normalizeSourceName(src.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({
      name: src.name,
      lean: src.lean || "center"
    });
  };

  (Array.isArray(modelSources) ? modelSources : []).forEach(add);
  (Array.isArray(groundingSources) ? groundingSources : []).forEach(add);

  return merged.slice(0, maxSources);
}

// --- Context Menu Setup ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "isThisTrue-text",
    title: 'Is This True? - Check selected text',
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "isThisTrue-image",
    title: 'Is This True? - Check this image',
    contexts: ["image"]
  });
});

// --- Context Menu Click Handler ---

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  try {
    if (info.menuItemId === "isThisTrue-text" && info.selectionText) {
      await handleTextCheck(info.selectionText, tab.id);
    } else if (info.menuItemId === "isThisTrue-image" && info.srcUrl) {
      await handleImageCheck(info.srcUrl, tab.id);
    }
  } catch (error) {
    console.error("[IsThisTrue] Unhandled context menu error", error);
  }
});

// --- Message Handler (from content script) ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender?.tab?.id;
  if (!tabId) return true;

  if (message.action === "checkText") {
    handleTextCheck(message.text, tabId).catch(error => {
      console.error("[IsThisTrue] Unhandled checkText error", error);
      sendToTab(tabId, {
        action: "showError",
        error: `Error: ${error.message}`
      });
    });
  } else if (message.action === "checkImage") {
    handleImageCheck(message.imageUrl, tabId).catch(error => {
      console.error("[IsThisTrue] Unhandled checkImage error", error);
      sendToTab(tabId, {
        action: "showError",
        error: `Error: ${error.message}`
      });
    });
  }
  return true;
});

// --- Progress Helper ---

function sendProgress(tabId, stepIndex, steps, stepLabelOverride = null, stepDetail = null) {
  sendToTab(tabId, {
    action: "updateProgress",
    currentStep: stepIndex,
    totalSteps: steps.length,
    stepLabel: stepLabelOverride || steps[stepIndex],
    stepDetail
  });
}

function startLiveProgressTicker(tabId, steps, stepIndex, requestId, labels, intervalMs = 3000) {
  if (!Array.isArray(labels) || labels.length === 0) {
    return () => {};
  }

  const startedAt = Date.now();
  let i = 0;
  sendProgress(tabId, stepIndex, steps, labels[0], "Starting source cross-check...");

  const timer = setInterval(() => {
    i += 1;
    const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const label = labels[i % labels.length];
    sendProgress(tabId, stepIndex, steps, label, `Still working... ${elapsedSec}s elapsed`);
    if (i % 3 === 0) {
      logInfo(requestId, "Still processing long-running model request", { elapsedSec, phase: label });
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

// --- Text Fact-Check ---

async function handleTextCheck(text, tabId) {
  const requestId = createRequestId("text");
  const startedAt = performance.now();
  logInfo(requestId, "Started text check", { tabId, textLength: text?.length || 0 });

  const steps = [
    "Analyzing claim",
    "Searching the web",
    "Cross-referencing sources",
    "Generating verdict"
  ];

  sendToTab(tabId, {
    action: "showLoading",
    type: "text",
    content: text,
    steps: steps,
    currentStep: 0
  });

  let crossRefTimer = null;
  let tickerTimer = null;
  let stopTicker = () => {};
  try {
    // Step 2: Searching the web (API call starts)
    sendProgress(tabId, 1, steps);

    // Advance to "Cross-referencing" and then provide live sub-step updates while waiting.
    crossRefTimer = setTimeout(() => {
      sendProgress(tabId, 2, steps, "Cross-referencing sources", "Comparing claims across sources...");
    }, 4000);
    tickerTimer = setTimeout(() => {
      stopTicker = startLiveProgressTicker(
        tabId,
        steps,
        2,
        requestId,
        [
          "Cross-referencing sources",
          "Extracting key claims",
          "Comparing evidence consistency",
          "Checking date/context relevance",
          "Reconciling conflicting reports"
        ],
        3000
      );
    }, 7000);

    const workerResult = await callWorker({
      type: "text",
      text: text
    }, requestId);

    clearTimeout(crossRefTimer);
    clearTimeout(tickerTimer);
    stopTicker();

    // Step 4: Generating verdict (response received, parsing)
    sendProgress(tabId, 3, steps, "Generating verdict", "Formatting final result...");

    const parsed = parseGeminiResponse(workerResult.response);
    parsed.groundingSources = workerResult.groundingSources || [];
    parsed.sources = mergeSourcesWithGrounding(
      parsed.sources,
      buildGroundingAnnotatedSources(parsed.groundingSources)
    );
    parsed.sources = applyAllSidesRatings(parsed.sources);
    parsed.confidence = calibrateConfidence(parsed, parsed.groundingSources);

    // Brief pause so user sees the final step before results appear
    await new Promise(r => setTimeout(r, 500));

    sendToTab(tabId, {
      action: "showResult",
      type: "text",
      content: text,
      result: parsed
    });
    logInfo(requestId, "Completed text check", {
      elapsedMs: Math.round(performance.now() - startedAt),
      verdict: parsed.verdict,
      confidence: parsed.confidence
    });
  } catch (error) {
    logError(requestId, "Text check failed", error);
    sendToTab(tabId, {
      action: "showError",
      error: `Error: ${error.message}`
    });
  } finally {
    if (crossRefTimer) {
      clearTimeout(crossRefTimer);
    }
    if (tickerTimer) {
      clearTimeout(tickerTimer);
    }
    stopTicker();
  }
}

// --- Image Fact-Check ---

async function handleImageCheck(imageUrl, tabId) {
  const requestId = createRequestId("image");
  const startedAt = performance.now();
  logInfo(requestId, "Started image check", { tabId, imageUrl });

  const steps = [
    "Analyzing image",
    "Searching the web",
    "Cross-referencing sources",
    "Generating verdict"
  ];

  sendToTab(tabId, {
    action: "showLoading",
    type: "image",
    content: imageUrl,
    steps: steps,
    currentStep: 0
  });

  // Keep the service worker alive during long image processing.
  // Chrome can terminate idle service workers after ~30s; this pings
  // the runtime every 20s to prevent premature termination.
  const keepAlive = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);

  let crossRefTimer = null;
  let tickerTimer = null;
  let stopTicker = () => {};
  try {
    // Step 2: Searching the web (worker fetches the image server-side)
    sendProgress(tabId, 1, steps);

    // Advance to "Cross-referencing" and then provide live sub-step updates while waiting.
    crossRefTimer = setTimeout(() => {
      sendProgress(tabId, 2, steps, "Cross-referencing sources", "Running grounded web verification...");
    }, 5000);
    tickerTimer = setTimeout(() => {
      stopTicker = startLiveProgressTicker(
        tabId,
        steps,
        2,
        requestId,
        [
          "Cross-referencing sources",
          "Extracting text from image context",
          "Matching claims against web results",
          "Checking source credibility mix",
          "Validating contradictory evidence"
        ],
        3000
      );
    }, 8000);

    // Send the image URL to the worker; it fetches and processes server-side
    const workerResult = await callWorker({
      type: "image",
      imageUrl: imageUrl
    }, requestId);

    clearTimeout(crossRefTimer);
    clearTimeout(tickerTimer);
    stopTicker();

    // Step 4: Generating verdict (response received, parsing)
    sendProgress(tabId, 3, steps, "Generating verdict", "Finalizing structured output...");

    const parsed = parseGeminiResponse(workerResult.response);
    parsed.groundingSources = workerResult.groundingSources || [];
    parsed.sources = mergeSourcesWithGrounding(
      parsed.sources,
      buildGroundingAnnotatedSources(parsed.groundingSources)
    );
    parsed.sources = applyAllSidesRatings(parsed.sources);
    parsed.confidence = calibrateConfidence(parsed, parsed.groundingSources);

    // Brief pause so user sees the final step before results appear
    await new Promise(r => setTimeout(r, 500));

    sendToTab(tabId, {
      action: "showResult",
      type: "image",
      content: imageUrl,
      result: parsed
    });
    logInfo(requestId, "Completed image check", {
      elapsedMs: Math.round(performance.now() - startedAt),
      verdict: parsed.verdict,
      confidence: parsed.confidence
    });
  } catch (error) {
    logError(requestId, "Image check failed", error);
    sendToTab(tabId, {
      action: "showError",
      error: `Error: ${error.message}`
    });
  } finally {
    if (crossRefTimer) {
      clearTimeout(crossRefTimer);
    }
    if (tickerTimer) {
      clearTimeout(tickerTimer);
    }
    stopTicker();
    clearInterval(keepAlive);
  }
}

// --- Worker API Call ---

async function callWorker(body, requestId = "worker") {
  // 90-second timeout: image checks with grounding + reasoning can take a while
  const controller = new AbortController();
  const startedAt = performance.now();
  const timeout = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

  logInfo(requestId, "Calling worker", {
    type: body?.type,
    payloadChars: JSON.stringify(body || {}).length
  });

  let response;
  try {
    response = await fetch(`${WORKER_URL}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      logWarn(requestId, "Worker request timed out", { timeoutMs: WORKER_TIMEOUT_MS });
      throw new Error("Request timed out. The image may be too complex or the server is busy. Please try again.");
    }
    logError(requestId, "Worker request network failure", err);
    throw new Error(`Network error: ${err.message}`);
  }
  clearTimeout(timeout);
  logInfo(requestId, "Worker responded", {
    status: response.status,
    elapsedMs: Math.round(performance.now() - startedAt)
  });

  // Safely parse JSON -- if the worker timed out, Cloudflare may return HTML
  let data;
  try {
    data = await response.json();
  } catch (err) {
    logError(requestId, "Failed to parse worker JSON", err);
    throw new Error(`Server returned an invalid response (HTTP ${response.status}). This may be a timeout -- please try again.`);
  }

  if (!response.ok) {
    logWarn(requestId, "Worker returned non-OK response", data);
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  logInfo(requestId, "Worker payload parsed successfully");
  return data;
}

// --- Response Parser ---
// With native JSON mode (responseMimeType + responseSchema) on the worker,
// the response is guaranteed valid JSON. We keep a lightweight fallback
// just in case the worker returns something unexpected.

function parseGeminiResponse(responseText) {
  if (!responseText) {
    return fallbackResult("No response received.");
  }

  try {
    const parsed = JSON.parse(responseText.trim());

    // Normalize sources: new schema returns objects {name, url, lean}, keep as-is
    const sources = Array.isArray(parsed.sources) ? parsed.sources.filter(Boolean) : [];

    return {
      verdict: parsed.verdict || "UNVERIFIABLE",
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0)),
      summary: parsed.summary || "Unable to determine.",
      details: parsed.details || "No details available.",
      reasoning: parsed.reasoning || "",
      topicType: parsed.topic_type || "other",
      perspectives: Array.isArray(parsed.perspectives) ? parsed.perspectives.filter(Boolean) : null,
      corrections: parsed.corrections || null,
      sources: sources
    };
  } catch {
    return fallbackResult(responseText);
  }
}

function calibrateConfidence(result, groundingSources = []) {
  const base = Math.min(100, Math.max(0, parseInt(result?.confidence, 10) || 0));
  const verdict = String(result?.verdict || "").toUpperCase();
  const sources = Array.isArray(result?.sources) ? result.sources : [];

  const uniqueNames = new Set(
    sources
      .map(s => (s?.name || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const uniqueLeans = new Set(
    sources
      .map(s => (s?.lean || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const groundingCount = Array.isArray(groundingSources) ? groundingSources.length : 0;
  let adjusted = base;

  // Keep confidence generally high, but avoid "95 every time" by anchoring
  // very-high outputs to observable evidence strength.
  const evidenceScore = (uniqueNames.size * 2) + groundingCount + (uniqueLeans.size * 2);

  if (base >= 95) {
    if (evidenceScore >= 18) {
      adjusted = 96 + Math.min(2, Math.floor((evidenceScore - 18) / 3)); // 96-98
    } else if (evidenceScore >= 13) {
      adjusted = 93 + Math.min(2, Math.floor((evidenceScore - 13) / 2)); // 93-95
    } else if (evidenceScore >= 9) {
      adjusted = 90 + Math.min(2, Math.floor((evidenceScore - 9) / 2)); // 90-92
    } else {
      adjusted = 86 + Math.min(2, Math.floor(evidenceScore / 4)); // 86-88
    }
  }

  // Still prevent unrealistic certainty when there is almost no evidence.
  if (uniqueNames.size <= 1 && groundingCount <= 1) adjusted = Math.min(adjusted, 84);

  // UNVERIFIABLE should stay high enough to feel useful, but not near-certain.
  if (verdict === "UNVERIFIABLE") adjusted = Math.min(adjusted, 78);

  return Math.round(Math.min(100, Math.max(0, adjusted)));
}

function fallbackResult(text) {
  return {
    verdict: "UNVERIFIABLE",
    confidence: 0,
    summary: "The response could not be parsed into a structured format.",
    details: text,
    corrections: null,
    sources: []
  };
}

// --- Helper: Send message to tab ---
// Content script is injected programmatically (not via manifest content_scripts)
// so we always ensure it is present before sending a message.

async function sendToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script not yet injected on this tab -- inject it now.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content.css"]
      });
      await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      console.error("[IsThisTrue] Failed to inject content script", err);
    }
  }
}
