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
  const HEADER_LOGO_URL = "data:image/png;base64,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";

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
          <div class="itt-header-brand">
            <div class="itt-logo-wrap">
              <img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" />
              <div class="itt-logo-glow"></div>
            </div>
            <div class="itt-header-text">
              <span class="itt-header-title">Is This True?</span>
              <span class="itt-header-tagline">AI-Powered Fact Checker</span>
            </div>
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
           <div class="itt-corrections-body">
             <p>${formatInline(result.corrections)}</p>
           </div>
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
          <div class="itt-header-brand">
            <div class="itt-logo-wrap">
              <img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" />
              <div class="itt-logo-glow"></div>
            </div>
            <div class="itt-header-text">
              <span class="itt-header-title">Is This True?</span>
              <span class="itt-header-tagline">Robust truth verification</span>
            </div>
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
          <div class="itt-header-brand">
            <div class="itt-logo-wrap">
              <img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" />
              <div class="itt-logo-glow"></div>
            </div>
            <div class="itt-header-text">
              <span class="itt-header-title">Is This True?</span>
              <span class="itt-header-tagline">AI-Powered Fact Checker</span>
            </div>
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

  function buildLeanTag(lean) {
    const config = {
      "left":         { label: "Left",          color: "#60A5FA", bg: "rgba(37, 99, 235, 0.12)" },
      "center-left":  { label: "Center-Left",   color: "#93C5FD", bg: "rgba(59, 130, 246, 0.10)" },
      "center":       { label: "Center",        color: "#C4B5FD", bg: "rgba(139, 92, 246, 0.10)" },
      "center-right": { label: "Center-Right",  color: "#FCA5A5", bg: "rgba(220, 38, 38, 0.10)" },
      "right":        { label: "Right",         color: "#F87171", bg: "rgba(220, 38, 38, 0.12)" },
      "nonpartisan":  { label: "Nonpartisan",   color: "#6EE7B7", bg: "rgba(5, 150, 105, 0.10)" }
    };

    const c = config[lean] || { label: lean || "Unknown", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.10)" };
    // Keep showing the lean result, but do not display the AllSides source label in UI.
    return `<span class="itt-lean-tag" style="background: ${c.bg}; color: ${c.color}; border-color: ${c.color}25;">${c.label}</span>`;
  }

  // --- Sources Builder ---

  function buildSourcesHTML(result) {
    const jsonSources = result.sources || [];

    // Model sources: name + lean tags (no links -- the model hallucinates URLs)
    const annotationItems = [];
    for (const src of jsonSources) {
      if (!src) continue;
      if (typeof src === "object" && src.name) {
        const leanTag = buildLeanTag(src.lean);
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

    const totalCount = annotationItems.length;
    if (totalCount === 0) return "";

    // Build inner content: model sources only
    let innerHTML = "";

    if (annotationItems.length > 0) {
      innerHTML += `
        <div class="itt-sources-group">
          <div class="itt-sources-group-label">Sources consulted</div>
          <div class="itt-sources-list">${annotationItems.join("")}</div>
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
