// ============================================================
// Is This True? - API and parsing logic (shared by main process)
// Ported from Chrome extension background.js
// ============================================================

const WORKER_URL = "https://is-this-true-api.isittrue.workers.dev";
const WORKER_TIMEOUT_MS = 90000;

function createRequestId(type) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- AllSides Media Bias Ratings (same as extension) ---
const ALLSIDES_RATINGS = {
  "msnbc": "left", "cnn": "left", "cnn news": "left", "vox": "left", "vox media": "left",
  "huffpost": "left", "huffington post": "left", "mother jones": "left", "jacobin": "left",
  "nation": "left", "democracy now": "left", "democracy now!": "left", "daily kos": "left",
  "salon": "left", "intercept": "left", "slate": "left", "buzzfeed news": "left", "buzzfeed": "left",
  "new republic": "left", "young turks": "left", "tyt": "left", "occupy democrats": "left",
  "raw story": "left", "alternet": "left", "daily beast": "left", "palmer report": "left",
  "msnbc news": "left", "second nexus": "left", "partisan girl": "left",
  "new york times": "center-left", "nyt": "center-left", "washington post": "center-left", "wapo": "center-left",
  "npr": "center-left", "national public radio": "center-left", "cbs news": "center-left", "cbs": "center-left",
  "nbc news": "center-left", "abc news": "center-left", "guardian": "center-left", "politico": "center-left",
  "bloomberg": "center-left", "bloomberg news": "center-left", "atlantic": "center-left", "time": "center-left",
  "time magazine": "center-left", "usa today": "center-left", "pbs": "center-left", "pbs newshour": "center-left",
  "axios": "center-left", "propublica": "center-left", "business insider": "center-left", "insider": "center-left",
  "independent": "center-left", "economist": "center-left", "vice": "center-left", "vice news": "center-left",
  "los angeles times": "center-left", "la times": "center-left", "new yorker": "center-left", "newsweek": "center-left",
  "ap news": "center",
  "associated press": "center", "ap": "center", "reuters": "center", "wall street journal": "center", "wsj": "center",
  "hill": "center", "realclearpolitics": "center", "rcp": "center", "forbes": "center", "c-span": "center",
  "cspan": "center", "christian science monitor": "center", "bbc": "center", "bbc news": "center",
  "marketwatch": "center", "allsides": "center", "ground news": "center", "just the news": "center",
  "new york post": "center-right", "ny post": "center-right", "washington times": "center-right",
  "washington examiner": "center-right", "dispatch": "center-right", "reason": "center-right",
  "reason magazine": "center-right", "free press": "center-right", "spectator": "center-right",
  "fox news": "right", "fox": "right", "breitbart": "right", "breitbart news": "right", "daily wire": "right",
  "daily caller": "right", "newsmax": "right", "one america news": "right", "one america news network": "right",
  "oan": "right", "oann": "right", "blaze": "right", "theblaze": "right", "blaze media": "right",
  "epoch times": "right", "federalist": "right", "gateway pundit": "right", "national review": "right",
  "townhall": "right", "american conservative": "right", "washington free beacon": "right",
  "prageru": "right", "prager university": "right", "new york sun": "right", "ben shapiro": "right",
};

function normalizeSourceName(name) {
  return (name || "").toLowerCase().trim().replace(/^the\s+/, "").replace(/\s+/g, " ");
}

function applyAllSidesRatings(sources) {
  if (!Array.isArray(sources)) return sources;
  return sources.map(src => {
    if (!src || typeof src !== "object" || !src.name) return src;
    const normalized = normalizeSourceName(src.name);
    const rating = ALLSIDES_RATINGS[normalized];
    if (rating) return { ...src, lean: rating, allsidesRated: true };
    return { ...src, allsidesRated: false };
  });
}

function extractHostname(rawUrl) {
  try { return new URL(rawUrl).hostname.toLowerCase(); } catch { return ""; }
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

const KNOWN_DOMAINS = [
  ["reuters.com", "Reuters"], ["apnews.com", "AP News"], ["nytimes.com", "New York Times"],
  ["washingtonpost.com", "Washington Post"], ["wsj.com", "Wall Street Journal"], ["foxnews.com", "Fox News"],
  ["cnn.com", "CNN"], ["bbc.com", "BBC"], ["bbc.co.uk", "BBC"], ["theguardian.com", "The Guardian"],
  ["npr.org", "NPR"], ["politico.com", "Politico"], ["axios.com", "Axios"], ["newsmax.com", "Newsmax"],
  ["breitbart.com", "Breitbart"], ["dailywire.com", "Daily Wire"], ["huffpost.com", "HuffPost"],
  ["msnbc.com", "MSNBC"], ["usatoday.com", "USA Today"], ["economist.com", "The Economist"],
  ["cbsnews.com", "CBS News"], ["nbcnews.com", "NBC News"], ["abcnews.go.com", "ABC News"],
  ["forbes.com", "Forbes"], ["marketwatch.com", "MarketWatch"], ["propublica.org", "ProPublica"],
  ["nature.com", "Nature"], ["science.org", "Science"]
];

function domainToSourceName(hostname) {
  const host = (hostname || "").toLowerCase();
  if (!host) return "";
  for (const [needle, label] of KNOWN_DOMAINS) {
    if (host === needle || host.endsWith(`.${needle}`)) return label;
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
    if (!url || url.includes("vertexaisearch.cloud.google.com") || url.includes("googleapis.com/grounding")) continue;
    const hostname = extractHostname(url);
    const name = titleToSourceName(src?.title || "") || domainToSourceName(hostname);
    if (!name) continue;
    const key = normalizeSourceName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({ name, lean: inferLeanFromHostname(hostname) });
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
    merged.push({ name: src.name, lean: src.lean || "center" });
  };
  (Array.isArray(modelSources) ? modelSources : []).forEach(add);
  (Array.isArray(groundingSources) ? groundingSources : []).forEach(add);
  return merged.slice(0, maxSources);
}

async function callWorker(body, requestId = "worker") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
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
      throw new Error("Request timed out. The image may be too complex or the server is busy. Please try again.");
    }
    throw new Error(`Network error: ${err.message}`);
  }
  clearTimeout(timeout);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Server returned an invalid response (HTTP ${response.status}). This may be a timeout -- please try again.`);
  }
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function parseGeminiResponse(responseText) {
  if (!responseText) return fallbackResult("No response received.");
  try {
    const parsed = JSON.parse(responseText.trim());
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
      sources
    };
  } catch {
    return fallbackResult(responseText);
  }
}

function calibrateConfidence(result, groundingSources = []) {
  const base = Math.min(100, Math.max(0, parseInt(result?.confidence, 10) || 0));
  const verdict = String(result?.verdict || "").toUpperCase();
  const sources = Array.isArray(result?.sources) ? result.sources : [];
  const uniqueNames = new Set(sources.map(s => (s?.name || "").trim().toLowerCase()).filter(Boolean));
  const uniqueLeans = new Set(sources.map(s => (s?.lean || "").trim().toLowerCase()).filter(Boolean));
  const groundingCount = Array.isArray(groundingSources) ? groundingSources.length : 0;
  let adjusted = base;
  const evidenceScore = (uniqueNames.size * 2) + groundingCount + (uniqueLeans.size * 2);
  if (base >= 95) {
    if (evidenceScore >= 18) adjusted = 96 + Math.min(2, Math.floor((evidenceScore - 18) / 3));
    else if (evidenceScore >= 13) adjusted = 93 + Math.min(2, Math.floor((evidenceScore - 13) / 2));
    else if (evidenceScore >= 9) adjusted = 90 + Math.min(2, Math.floor((evidenceScore - 9) / 2));
    else adjusted = 86 + Math.min(2, Math.floor(evidenceScore / 4));
  }
  if (uniqueNames.size <= 1 && groundingCount <= 1) adjusted = Math.min(adjusted, 84);
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

module.exports = {
  createRequestId,
  callWorker,
  parseGeminiResponse,
  applyAllSidesRatings,
  buildGroundingAnnotatedSources,
  mergeSourcesWithGrounding,
  calibrateConfidence,
  fallbackResult
};
