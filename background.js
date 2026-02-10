// ============================================================
// Is This True? - Background Service Worker
// Sends requests to Cloudflare Worker proxy for fact-checking
// ============================================================

const WORKER_URL = "https://is-this-true-api.isittrue.workers.dev";
const IMAGE_FETCH_TIMEOUT_MS = 30000;
const WORKER_TIMEOUT_MS = 90000;
const MAX_IMAGE_SIZE_BYTES = 12 * 1024 * 1024; // 12MB

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
    parsed.sources = applyAllSidesRatings(parsed.sources);
    parsed.groundingSources = workerResult.groundingSources || [];

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
    "Downloading image data",
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
    // Step 2: Downloading image
    sendProgress(tabId, 1, steps);

    // Fetch image and convert to base64 in the extension
    // (extension has <all_urls> permission so it can fetch from any origin)
    const imageData = await fetchImageAsBase64(imageUrl, requestId);
    logInfo(requestId, "Image prepared for worker", {
      mimeType: imageData.mimeType,
      imageBytes: imageData.byteLength,
      base64Length: imageData.base64.length
    });

    // Step 3: Searching the web (API call starts)
    sendProgress(tabId, 2, steps);

    // Advance to "Cross-referencing" and then provide live sub-step updates while waiting.
    crossRefTimer = setTimeout(() => {
      sendProgress(tabId, 3, steps, "Cross-referencing sources", "Running grounded web verification...");
    }, 5000);
    tickerTimer = setTimeout(() => {
      stopTicker = startLiveProgressTicker(
        tabId,
        steps,
        3,
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

    const workerResult = await callWorker({
      type: "image",
      imageBase64: imageData.base64,
      mimeType: imageData.mimeType
    }, requestId);

    clearTimeout(crossRefTimer);
    clearTimeout(tickerTimer);
    stopTicker();

    // Step 5: Generating verdict (response received, parsing)
    sendProgress(tabId, 4, steps, "Generating verdict", "Finalizing structured output...");

    const parsed = parseGeminiResponse(workerResult.response);
    parsed.sources = applyAllSidesRatings(parsed.sources);
    parsed.groundingSources = workerResult.groundingSources || [];

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

// --- Image Fetching ---

async function fetchImageAsBase64(imageUrl, requestId = "image") {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  logInfo(requestId, "Fetching image bytes", { imageUrl });
  const response = await fetch(imageUrl, { signal: controller.signal }).catch(err => {
    if (err?.name === "AbortError") {
      throw new Error(`Timed out while downloading image (${Math.round(IMAGE_FETCH_TIMEOUT_MS / 1000)}s)`);
    }
    throw err;
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || "image/png";
  const byteLength = blob.size;
  logInfo(requestId, "Downloaded image blob", {
    mimeType,
    byteLength,
    elapsedMs: Math.round(performance.now() - startedAt)
  });

  if (byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Image is too large (${Math.round(byteLength / (1024 * 1024))}MB). Please try an image under ${Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB.`);
  }

  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const base64 = await uint8ArrayToBase64(uint8Array);
  logInfo(requestId, "Converted image to base64", {
    base64Length: base64.length,
    elapsedMs: Math.round(performance.now() - startedAt)
  });

  return { base64, mimeType, byteLength };
}

async function uint8ArrayToBase64(uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);

    // Yield occasionally so long conversions do not freeze worker execution.
    if (i > 0 && i % (chunkSize * 128) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return btoa(binary);
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

function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    }).then(() => {
      chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content.css"]
      }).then(() => {
        chrome.tabs.sendMessage(tabId, message);
      });
    }).catch(console.error);
  });
}
