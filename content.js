// ============================================================
// Is This True? - Content Script
// Renders the fact-check overlay on the page
// Responsive: desktop side panel + mobile bottom sheet with
// touch gestures, FAB trigger, and swipe-to-dismiss
// ============================================================

(() => {
  // Prevent multiple injections
  if (window.__isThisTrueInjected) return;
  window.__isThisTrueInjected = true;

  const PANEL_ID = "isThisTrue-panel";
  const FAB_ID = "isThisTrue-fab";
  const BACKDROP_ID = "isThisTrue-backdrop";
  const HEADER_LOGO_URL = chrome.runtime.getURL("icons/icon48.png");

  // --- Mobile / Touch Detection ---

  function isMobileLayout() {
    return window.innerWidth <= 480;
  }

  function isTouchDevice() {
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    );
  }

  // --- Message Listener ---

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case "showLoading":
        showPanel(buildLoadingHTML(message.type, message.content, message.steps, message.currentStep));
        break;
      case "updateProgress":
        updateProgressUI(message.currentStep, message.totalSteps, message.stepLabel, message.stepDetail);
        break;
      case "showResult":
        showPanel(buildResultHTML(message.type, message.content, message.result));
        break;
      case "showError":
        showPanel(buildErrorHTML(message.error));
        break;
    }
  });

  // --- Panel Management ---

  function showPanel(innerHTML) {
    removePanel();
    removeFab();

    // Create backdrop for mobile
    if (isMobileLayout()) {
      createBackdrop();
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = innerHTML;
    document.body.appendChild(panel);

    // Attach close handler
    const closeBtn = panel.querySelector(".itt-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", removePanel);
    }

    // Attach details toggle handler
    const detailsToggle = panel.querySelector(".itt-details-toggle");
    if (detailsToggle) {
      detailsToggle.addEventListener("click", () => {
        detailsToggle.parentElement.classList.toggle("itt-open");
      });
    }

    // Attach perspectives toggle handler
    const perspectivesToggle = panel.querySelector(".itt-perspectives-toggle");
    if (perspectivesToggle) {
      perspectivesToggle.addEventListener("click", () => {
        perspectivesToggle.parentElement.classList.toggle("itt-open");
      });
    }

    // Attach sources toggle handler
    const sourcesToggle = panel.querySelector(".itt-sources-toggle");
    if (sourcesToggle) {
      sourcesToggle.addEventListener("click", () => {
        sourcesToggle.parentElement.classList.toggle("itt-open");
      });
    }

    // Setup mobile touch gestures (swipe-to-dismiss on drag handle)
    if (isMobileLayout() || isTouchDevice()) {
      setupSwipeToDismiss(panel);
    }

    // Animate in
    requestAnimationFrame(() => {
      panel.classList.add("itt-visible");
      const backdrop = document.getElementById(BACKDROP_ID);
      if (backdrop) {
        backdrop.classList.add("itt-visible");
      }
    });
  }

  function removePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      // Prevent stacked touch listeners across repeated panel opens.
      if (typeof existing.__ittCleanup === "function") {
        existing.__ittCleanup();
      }
      existing.classList.remove("itt-visible");
      setTimeout(() => existing.remove(), 300);
    }
    removeBackdrop();
  }

  // --- Backdrop (mobile) ---

  function createBackdrop() {
    removeBackdrop();
    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.classList.add("itt-backdrop-active");
    backdrop.addEventListener("click", removePanel);
    document.body.appendChild(backdrop);
  }

  function removeBackdrop() {
    const existing = document.getElementById(BACKDROP_ID);
    if (existing) {
      existing.classList.remove("itt-visible");
      setTimeout(() => existing.remove(), 300);
    }
  }

  // --- FAB (Floating Action Button for mobile) ---

  function showFab() {
    let fab = document.getElementById(FAB_ID);
    if (!fab) {
      fab = document.createElement("button");
      fab.id = FAB_ID;
      fab.textContent = "?";
      fab.setAttribute("aria-label", "Fact-check selected text");
      fab.addEventListener("click", handleFabClick);
      document.body.appendChild(fab);
    }

    // Show with small delay so transition works
    requestAnimationFrame(() => {
      fab.classList.add("itt-fab-visible");
      fab.classList.remove("itt-fab-hidden");
    });
  }

  function removeFab() {
    const fab = document.getElementById(FAB_ID);
    if (fab) {
      fab.classList.add("itt-fab-hidden");
      fab.classList.remove("itt-fab-visible");
      setTimeout(() => fab.remove(), 300);
    }
  }

  function handleFabClick() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // Send message to background to fact-check
      chrome.runtime.sendMessage({
        action: "checkText",
        text: selectedText
      });
    }
    removeFab();
  }

  // --- Text Selection Listener (mobile FAB trigger) ---

  let selectionTimeout = null;

  document.addEventListener("selectionchange", () => {
    // Only show FAB on mobile/touch or when context menu might not be available
    if (!isMobileLayout() && !isTouchDevice()) return;

    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(() => {
      const selectedText = window.getSelection().toString().trim();

      if (selectedText && selectedText.length > 3) {
        showFab();
      } else {
        removeFab();
      }
    }, 400);
  });

  // --- Swipe-to-Dismiss (mobile bottom sheet) ---

  function setupSwipeToDismiss(panel) {
    const dragHandle = panel.querySelector(".itt-drag-handle");
    const header = panel.querySelector(".itt-header");
    const triggers = [dragHandle, header].filter(Boolean);

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    function onTouchStart(e) {
      // Only initiate drag from the handle or header
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      panel.style.transition = "none";
    }

    function onTouchMove(e) {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      // Only allow dragging downward (to dismiss)
      if (deltaY > 0) {
        panel.style.transform = `translateY(${deltaY}px)`;
        // Fade backdrop proportionally
        const backdrop = document.getElementById(BACKDROP_ID);
        if (backdrop) {
          const progress = Math.min(deltaY / 200, 1);
          backdrop.style.opacity = String(1 - progress);
        }
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = currentY - startY;

      panel.style.transition = "";

      if (deltaY > 100) {
        // Dismiss threshold reached
        removePanel();
      } else {
        // Snap back
        panel.style.transform = "";
        const backdrop = document.getElementById(BACKDROP_ID);
        if (backdrop) {
          backdrop.style.opacity = "";
        }
        // Re-apply visible class for proper state
        requestAnimationFrame(() => {
          panel.classList.add("itt-visible");
        });
      }
    }

    for (const trigger of triggers) {
      trigger.addEventListener("touchstart", onTouchStart, { passive: true });
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    // Store cleanup reference
    panel.__ittCleanup = () => {
      for (const trigger of triggers) {
        trigger.removeEventListener("touchstart", onTouchStart);
      }
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }

  // --- Verdict Styling ---

  function getVerdictConfig(verdict) {
    const v = (verdict || "").toUpperCase();
    if (v === "TRUE") {
      return { color: "#34D399", bg: "rgba(16, 185, 129, 0.1)", icon: "&#10003;", label: "True" };
    } else if (v === "FALSE") {
      return { color: "#F87171", bg: "rgba(239, 68, 68, 0.1)", icon: "&#10007;", label: "False" };
    } else if (v === "PARTIALLY TRUE") {
      return { color: "#FBBF24", bg: "rgba(245, 158, 11, 0.1)", icon: "&#9888;", label: "Partially True" };
    } else {
      return { color: "#94A3B8", bg: "rgba(148, 163, 184, 0.1)", icon: "?", label: "Unverifiable" };
    }
  }

  // --- Confidence Bar ---

  function buildConfidenceBar(confidence, color) {
    return `
      <div class="itt-confidence-wrap">
        <div class="itt-confidence-label">
          <span>Confidence</span>
          <span class="itt-confidence-value">${confidence}%</span>
        </div>
        <div class="itt-confidence-track">
          <div class="itt-confidence-fill" style="width: ${confidence}%; background: linear-gradient(90deg, ${color}, ${color}CC);"></div>
        </div>
      </div>
    `;
  }

  // --- Drag Handle HTML (mobile) ---

  function buildDragHandle() {
    return `
      <div class="itt-drag-handle">
        <div class="itt-drag-handle-bar"></div>
      </div>
    `;
  }

  // --- Loading HTML ---

  function buildLoadingHTML(type, content, steps, currentStep) {
    const preview = type === "image"
      ? `<img src="${escapeHtml(content)}" class="itt-preview-img" />`
      : `<p class="itt-preview-text">"${escapeHtml(truncate(content, 150))}"</p>`;

    steps = steps || ["Analyzing", "Searching the web", "Verifying"];
    currentStep = currentStep || 0;
    const percent = Math.round(((currentStep + 1) / steps.length) * 90);
    const currentLabel = steps[currentStep] || "Processing...";

    return `
      <div class="itt-inner">
        ${buildDragHandle()}
        <div class="itt-header">
          <div class="itt-title">
            <span class="itt-logo"><img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" /></span>
            <span>Is This True?</span>
          </div>
          <button class="itt-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="itt-body">
          <div class="itt-checking-label">Checking ${type}...</div>
          ${preview}
          <div class="itt-progress-bar">
            <div class="itt-progress-fill" style="width: ${percent}%"></div>
          </div>
          <div class="itt-status-line">
            <div class="itt-step-spinner"></div>
            <div class="itt-status-copy">
              <span class="itt-status-text">${escapeHtml(currentLabel)}</span>
              <div class="itt-status-subtext">Initializing...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- Progress Updater (in-place DOM update) ---

function updateProgressUI(currentStep, totalSteps, stepLabel, stepDetail) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    // Update progress bar
    const percent = Math.round(((currentStep + 1) / totalSteps) * 90);
    const fill = panel.querySelector(".itt-progress-fill");
    if (fill) {
      fill.style.width = percent + "%";
    }

    // Update status text
    const statusText = panel.querySelector(".itt-status-text");
    if (statusText && stepLabel) {
      statusText.textContent = stepLabel;
    }

  const statusSubtext = panel.querySelector(".itt-status-subtext");
  if (statusSubtext && stepDetail) {
    statusSubtext.textContent = stepDetail;
  }
  }

  // --- Result HTML ---

  function buildResultHTML(type, content, result) {
    const vc = getVerdictConfig(result.verdict);

    const preview = type === "image"
      ? `<img src="${escapeHtml(content)}" class="itt-preview-img" />`
      : `<p class="itt-preview-text">"${escapeHtml(truncate(content, 150))}"</p>`;

    const corrections = result.corrections
      ? `<div class="itt-corrections">
           <div class="itt-corrections-title">Correction</div>
           <p>${formatInline(result.corrections)}</p>
         </div>`
      : "";

    // Build topic type badge (shown for political/controversial topics)
    const topicBadge = buildTopicBadge(result.topicType);

    // Build perspectives section (only for political/controversial topics)
    const perspectivesSection = buildPerspectivesHTML(result.perspectives);

    // Build sources list from both Gemini JSON response and grounding metadata
    const allSources = buildSourcesHTML(result);

    return `
      <div class="itt-inner">
        ${buildDragHandle()}
        <div class="itt-header">
          <div class="itt-title">
            <span class="itt-logo"><img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" /></span>
            <span>Is This True?</span>
          </div>
          <button class="itt-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="itt-body">
          ${preview}
          <div class="itt-verdict-row">
            <div class="itt-verdict-badge" style="background: ${vc.bg}; color: ${vc.color}; border: 1px solid ${vc.color}30;">
              <span class="itt-verdict-icon">${vc.icon}</span>
              <span class="itt-verdict-label">${vc.label}</span>
            </div>
            ${topicBadge}
          </div>
          ${buildConfidenceBar(result.confidence, vc.color)}
          <div class="itt-summary">${escapeHtml(result.summary)}</div>
          <div class="itt-details-section">
            <button class="itt-details-toggle">
              Show Details
              <span class="itt-chevron">&#9660;</span>
            </button>
            <div class="itt-details-content">
              <div class="itt-details-body">${formatDetails(result.details)}</div>
              ${corrections}
            </div>
          </div>
          ${perspectivesSection}
          ${allSources}
        </div>
        <div class="itt-footer">
          <span>Verified using real-time web search</span>
        </div>
      </div>
    `;
  }

  // --- Error HTML ---

  function buildErrorHTML(error) {
    return `
      <div class="itt-inner">
        ${buildDragHandle()}
        <div class="itt-header">
          <div class="itt-title">
            <span class="itt-logo"><img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" /></span>
            <span>Is This True?</span>
          </div>
          <button class="itt-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="itt-body">
          <div class="itt-error">
            <div class="itt-error-icon">!</div>
            <p>${escapeHtml(error)}</p>
          </div>
        </div>
      </div>
    `;
  }

  // --- Topic Badge Builder ---

  function buildTopicBadge(topicType) {
    const config = {
      political:     { label: "Political",      color: "#C4B5FD", bg: "rgba(139, 92, 246, 0.12)" },
      controversial: { label: "Controversial",  color: "#FCD34D", bg: "rgba(245, 158, 11, 0.12)" },
      scientific:    { label: "Scientific",     color: "#67E8F9", bg: "rgba(8, 145, 178, 0.12)" },
      historical:    { label: "Historical",     color: "#FDE68A", bg: "rgba(146, 64, 14, 0.12)" },
      factual:       { label: "Factual",        color: "#6EE7B7", bg: "rgba(5, 150, 105, 0.12)" },
      other:         { label: "",               color: "",        bg: "" }
    };

    const c = config[topicType] || config.other;
    if (!c.label) return "";

    return `<span class="itt-topic-badge" style="background: ${c.bg}; color: ${c.color}; border: 1px solid ${c.color}25;">${c.label}</span>`;
  }

  // --- Perspectives Builder ---

  function buildPerspectivesHTML(perspectives) {
    if (!perspectives || !Array.isArray(perspectives) || perspectives.length === 0) return "";

    const blocks = perspectives.map(p => {
      if (!p || !p.side) return "";
      return `
        <div class="itt-perspective-block">
          <div class="itt-perspective-side">${escapeHtml(p.side)}</div>
          <div class="itt-perspective-summary">${escapeHtml(p.summary || "")}</div>
        </div>
      `;
    }).filter(Boolean).join("");

    if (!blocks) return "";

    return `
      <div class="itt-perspectives-section">
        <button class="itt-perspectives-toggle">
          Multiple Perspectives (${perspectives.length})
          <span class="itt-chevron">&#9660;</span>
        </button>
        <div class="itt-perspectives-content">
          ${blocks}
        </div>
      </div>
    `;
  }

  // --- Source Bias Tag ---

  function buildLeanTag(lean, allsidesRated) {
    const config = {
      "left":         { label: "Left",          color: "#60A5FA", bg: "rgba(37, 99, 235, 0.12)" },
      "center-left":  { label: "Center-Left",   color: "#93C5FD", bg: "rgba(59, 130, 246, 0.10)" },
      "center":       { label: "Center",        color: "#C4B5FD", bg: "rgba(139, 92, 246, 0.10)" },
      "center-right": { label: "Center-Right",  color: "#FCA5A5", bg: "rgba(220, 38, 38, 0.10)" },
      "right":        { label: "Right",         color: "#F87171", bg: "rgba(220, 38, 38, 0.12)" },
      "nonpartisan":  { label: "Nonpartisan",   color: "#6EE7B7", bg: "rgba(5, 150, 105, 0.10)" }
    };

    const c = config[lean] || { label: lean || "Unknown", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.10)" };
    const asLabel = allsidesRated
      ? `<span class="itt-allsides-badge" title="Rating from AllSides.com">AllSides</span>`
      : "";
    return `<span class="itt-lean-tag" style="background: ${c.bg}; color: ${c.color}; border-color: ${c.color}25;">${c.label}</span>${asLabel}`;
  }

  // --- Sources Builder ---

  function buildSourcesHTML(result) {
    const groundingSources = result.groundingSources || [];
    const jsonSources = result.sources || [];

    // Helper to check if a URL is a real source (not a Google internal redirect)
    function isRealUrl(url) {
      if (!url) return false;
      if (url.includes("vertexaisearch.cloud.google.com")) return false;
      if (url.includes("googleapis.com/grounding")) return false;
      return true;
    }

    // Model sources: name + lean tags (no links -- the model hallucinates URLs)
    const annotationItems = [];
    for (const src of jsonSources) {
      if (!src) continue;
      if (typeof src === "object" && src.name) {
        const leanTag = buildLeanTag(src.lean, src.allsidesRated);
        annotationItems.push(
          `<div class="itt-source-item">
            <span class="itt-source-text">${escapeHtml(src.name)}</span>
            ${leanTag}
          </div>`
        );
      } else if (typeof src === "string" && src) {
        annotationItems.push(
          `<div class="itt-source-item">
            <span class="itt-source-text">${escapeHtml(src)}</span>
          </div>`
        );
      }
    }

    // Grounding sources: real verified URLs from the Google Search API
    const linkItems = [];
    const seenUrls = new Set();
    for (const src of groundingSources) {
      if (src.url && isRealUrl(src.url) && !seenUrls.has(src.url)) {
        seenUrls.add(src.url);
        const displayName = src.title || src.url;
        linkItems.push(
          `<div class="itt-source-item">
            <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener" class="itt-source-link">${escapeHtml(displayName)}</a>
          </div>`
        );
      }
    }

    const totalCount = annotationItems.length + linkItems.length;
    if (totalCount === 0) return "";

    // Build inner content: annotations first, then verified links
    let innerHTML = "";

    if (annotationItems.length > 0) {
      innerHTML += `
        <div class="itt-sources-group">
          <div class="itt-sources-group-label">Sources consulted</div>
          <div class="itt-sources-list">${annotationItems.join("")}</div>
        </div>
      `;
    }

    if (linkItems.length > 0) {
      innerHTML += `
        <div class="itt-sources-group">
          <div class="itt-sources-group-label">Verified references</div>
          <div class="itt-sources-list">${linkItems.join("")}</div>
        </div>
      `;
    }

    return `
      <div class="itt-sources-section">
        <button class="itt-sources-toggle">
          Sources (${totalCount})
          <span class="itt-chevron">&#9660;</span>
        </button>
        <div class="itt-sources-content">
          ${innerHTML}
        </div>
      </div>
    `;
  }

  // --- Utilities ---

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) + "..." : str;
  }

  // --- Details Formatter ---
  // Converts the plain-text details string from the model into
  // structured HTML with paragraphs, sub-headers, lists, and bold.

  function formatInline(text) {
    let safe = escapeHtml(text);
    // Bold: **text** -> <strong>text</strong>
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return safe;
  }

  function formatDetails(text) {
    if (!text) return "";

    const lines = text.split("\n");
    const blocks = [];
    let listItems = [];
    let listType = null; // "ol" or "ul"

    function flushList() {
      if (listItems.length > 0) {
        const tag = listType || "ul";
        blocks.push(`<${tag} class="itt-details-list">${listItems.join("")}</${tag}>`);
        listItems = [];
        listType = null;
      }
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Empty line: close any open list
      if (!line) {
        flushList();
        continue;
      }

      // Numbered list item: "1. text", "2) text"
      const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
      if (numberedMatch) {
        if (listType && listType !== "ol") flushList();
        listType = "ol";
        listItems.push(`<li>${formatInline(numberedMatch[2])}</li>`);
        continue;
      }

      // Bullet list item: "- text", "* text", "• text"
      const bulletMatch = line.match(/^[-*\u2022]\s+(.+)/);
      if (bulletMatch) {
        if (listType && listType !== "ul") flushList();
        listType = "ul";
        listItems.push(`<li>${formatInline(bulletMatch[1])}</li>`);
        continue;
      }

      // Not a list item -- flush any open list
      flushList();

      // Bold-only header line: "**Some Header**" or "**Some Header:**"
      const boldHeaderMatch = line.match(/^\*\*(.+?)\*\*:?\s*$/);
      if (boldHeaderMatch) {
        blocks.push(`<div class="itt-details-subheader">${escapeHtml(boldHeaderMatch[1])}</div>`);
        continue;
      }

      // Section header: lines like "Claim 1: ...", "Overall:", "Conclusion:", etc.
      const sectionMatch = line.match(/^(Claim\s+\d+|Overall|Conclusion|Summary|Analysis|Evidence|Verdict|Finding|Assessment|Result)\s*:\s*(.*)$/i);
      if (sectionMatch) {
        blocks.push(`<div class="itt-details-subheader">${escapeHtml(sectionMatch[1])}</div>`);
        if (sectionMatch[2].trim()) {
          blocks.push(`<p>${formatInline(sectionMatch[2].trim())}</p>`);
        }
        continue;
      }

      // Regular paragraph
      blocks.push(`<p>${formatInline(line)}</p>`);
    }

    flushList();
    return blocks.join("");
  }
})();
