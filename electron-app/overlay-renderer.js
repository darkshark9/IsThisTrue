// ============================================================
// Is This True? - Overlay window renderer (extension-style panel only)
// ============================================================

(function () {
  const PANEL_ID = "isThisTrue-panel";
  const CONTAINER_ID = "isThisTrue-panel-container";
  let HEADER_LOGO_URL = "";
  let lastPanelPosition = null;

  const container = () => document.getElementById(CONTAINER_ID);

  function isMobileLayout() {
    return window.innerWidth <= 480;
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0 ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  }

  function initMessageListener() {
    window.electronAPI.onMessage((message) => {
      if (message.iconUrl) {
        HEADER_LOGO_URL = message.iconUrl;
      }
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
        case "showAiImageResult":
          showPanel(buildAiImageResultHTML(message.content, message.result));
          break;
        case "showError":
          showPanel(buildErrorHTML(message.error));
          break;
      }
    });
  }

  function showPanel(innerHTML) {
    const cnt = container();
    if (!cnt) return;
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      if (typeof existing.__ittCleanup === "function") existing.__ittCleanup();
      existing.classList.remove("itt-visible");
      setTimeout(() => existing.remove(), 300);
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = innerHTML;
    if (lastPanelPosition) {
      panel.style.right = "auto";
      panel.style.left = lastPanelPosition.left + "px";
      panel.style.top = lastPanelPosition.top + "px";
      panel.classList.add("itt-restored-position");
    }
    cnt.appendChild(panel);

    setupDesktopDrag(panel);

    // Enable mouse interaction when hovering the panel
    panel.addEventListener("mouseenter", () => {
      if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
        window.electronAPI.setIgnoreMouseEvents(false);
      }
    });
    panel.addEventListener("mouseleave", () => {
      if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    });

    const closeBtn = panel.querySelector(".itt-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        removePanel();
        if (window.electronAPI && window.electronAPI.closeOverlay) {
          window.electronAPI.closeOverlay();
        }
      });
    }

    const detailsToggle = panel.querySelector(".itt-details-toggle");
    if (detailsToggle) {
      detailsToggle.addEventListener("click", () => detailsToggle.parentElement.classList.toggle("itt-open"));
    }
    const perspectivesToggle = panel.querySelector(".itt-perspectives-toggle");
    if (perspectivesToggle) {
      perspectivesToggle.addEventListener("click", () => perspectivesToggle.parentElement.classList.toggle("itt-open"));
    }
    const sourcesToggle = panel.querySelector(".itt-sources-toggle");
    if (sourcesToggle) {
      sourcesToggle.addEventListener("click", () => sourcesToggle.parentElement.classList.toggle("itt-open"));
    }

    if (isMobileLayout() || isTouchDevice()) setupSwipeToDismiss(panel);

    requestAnimationFrame(() => panel.classList.add("itt-visible"));
  }

  function removePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      if (typeof existing.__ittCleanup === "function") existing.__ittCleanup();
      existing.classList.remove("itt-visible");
      setTimeout(() => existing.remove(), 300);
      // Ensure we go back to ignoring mouse events when panel is removed
      if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }

  function setupDesktopDrag(panel) {
    const dragHandle = panel.querySelector(".itt-drag-handle");
    const header = panel.querySelector(".itt-header");
    const dragTargets = [dragHandle, header].filter(Boolean);
    let startClientX = 0, startClientY = 0, startPanelLeft = 0, startPanelTop = 0;

    function clampPosition(left, top, width, height) {
      const L = Math.max(0, Math.min(left, window.innerWidth - width));
      const T = Math.max(0, Math.min(top, window.innerHeight - height));
      return { left: L, top: T };
    }

    function onMouseDown(e) {
      if (e.button !== 0) return;
      if (header && e.target.closest(".itt-close-btn")) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      startClientX = e.clientX;
      startClientY = e.clientY;
      startPanelLeft = rect.left;
      startPanelTop = rect.top;
      panel.style.right = "auto";
      panel.classList.add("itt-dragging");
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
      const deltaX = e.clientX - startClientX;
      const deltaY = e.clientY - startClientY;
      const { left, top } = clampPosition(
        startPanelLeft + deltaX,
        startPanelTop + deltaY,
        panel.offsetWidth,
        panel.offsetHeight
      );
      panel.style.left = left + "px";
      panel.style.top = top + "px";
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      panel.classList.remove("itt-dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const rect = panel.getBoundingClientRect();
      lastPanelPosition = { left: rect.left, top: rect.top };
    }

    dragTargets.forEach((el) => el.addEventListener("mousedown", onMouseDown));
    const cleanup = () => dragTargets.forEach((el) => el.removeEventListener("mousedown", onMouseDown));
    if (typeof panel.__ittCleanup === "function") {
      const prev = panel.__ittCleanup;
      panel.__ittCleanup = () => { cleanup(); prev(); };
    } else {
      panel.__ittCleanup = cleanup;
    }
  }

  function setupSwipeToDismiss(panel) {
    const dragHandle = panel.querySelector(".itt-drag-handle");
    const header = panel.querySelector(".itt-header");
    const triggers = [dragHandle, header].filter(Boolean);
    let startY = 0, currentY = 0, isDragging = false;

    function onTouchStart(e) {
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      panel.style.transition = "none";
    }
    function onTouchMove(e) {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      if (deltaY > 0) {
        panel.style.transform = `translateY(${deltaY}px)`;
        e.preventDefault();
      }
    }
    function onTouchEnd() {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = currentY - startY;
      panel.style.transition = "";
      if (deltaY > 100) {
        removePanel();
        if (window.electronAPI && window.electronAPI.closeOverlay) window.electronAPI.closeOverlay();
      } else {
        panel.style.transform = "";
        requestAnimationFrame(() => panel.classList.add("itt-visible"));
      }
    }
    triggers.forEach(t => t.addEventListener("touchstart", onTouchStart, { passive: true }));
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    const swipeCleanup = () => {
      triggers.forEach(t => t.removeEventListener("touchstart", onTouchStart));
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
    const prevCleanup = panel.__ittCleanup;
    panel.__ittCleanup = prevCleanup ? () => { swipeCleanup(); prevCleanup(); } : swipeCleanup;
  }

  function getVerdictConfig(verdict) {
    const v = (verdict || "").toUpperCase();
    if (v === "TRUE") return { color: "#34D399", bg: "rgba(16, 185, 129, 0.1)", icon: "&#10003;", label: "True" };
    if (v === "FALSE") return { color: "#F87171", bg: "rgba(239, 68, 68, 0.1)", icon: "&#10007;", label: "False" };
    if (v === "PARTIALLY TRUE") return { color: "#FBBF24", bg: "rgba(245, 158, 11, 0.1)", icon: "&#9888;", label: "Partially True" };
    return { color: "#94A3B8", bg: "rgba(148, 163, 184, 0.1)", icon: "?", label: "Unverifiable" };
  }

  function getAiVerdictConfig(verdict) {
    const v = (verdict || "").toUpperCase();
    if (v === "AI_GENERATED") return { color: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", icon: "&#9888;", label: "AI Generated" };
    if (v === "HUMAN_LIKELY") return { color: "#34D399", bg: "rgba(16, 185, 129, 0.1)", icon: "&#10003;", label: "Human likely" };
    return { color: "#94A3B8", bg: "rgba(148, 163, 184, 0.1)", icon: "?", label: "Uncertain" };
  }

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
      </div>`;
  }

  function buildDragHandle() {
    return `<div class="itt-drag-handle"><div class="itt-drag-handle-bar"></div></div>`;
  }

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

  function buildLoadingHTML(type, content, steps, currentStep) {
    const isImage = type === "image" || type === "ai-image";
    const preview = isImage
      ? `<img src="${escapeHtml(content)}" class="itt-preview-img" />`
      : `<p class="itt-preview-text">"${escapeHtml(truncate(content, 150))}"</p>`;
    const checkLabel = type === "ai-image" ? "Checking if AI-generated..." : `Checking ${type}...`;
    steps = steps || ["Analyzing", "Searching the web", "Verifying"];
    currentStep = currentStep || 0;
    const percent = Math.round(((currentStep + 1) / steps.length) * 90);
    const currentLabel = steps[currentStep] || "Processing...";
    const logo = HEADER_LOGO_URL ? `<img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" />` : "";
    return `
      <div class="itt-inner">
        ${buildDragHandle()}
        <div class="itt-header">
          <div class="itt-header-brand">
            <div class="itt-logo-wrap">${logo}<div class="itt-logo-glow"></div></div>
            <div class="itt-header-text">
              <span class="itt-header-title">Is This True?</span>
              <span class="itt-header-tagline">Robust truth verification</span>
            </div>
          </div>
          <button class="itt-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="itt-body">
          <div class="itt-checking-label">${escapeHtml(checkLabel)}</div>
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
      </div>`;
  }

  function updateProgressUI(currentStep, totalSteps, stepLabel, stepDetail) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const percent = Math.round(((currentStep + 1) / totalSteps) * 90);
    const fill = panel.querySelector(".itt-progress-fill");
    if (fill) fill.style.width = percent + "%";
    const statusText = panel.querySelector(".itt-status-text");
    if (statusText && stepLabel) statusText.textContent = stepLabel;
    const statusSubtext = panel.querySelector(".itt-status-subtext");
    if (statusSubtext && stepDetail) statusSubtext.textContent = stepDetail;
  }

  function formatInline(text) {
    let safe = escapeHtml(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return safe;
  }

  function formatDetails(text) {
    if (!text) return "";
    const lines = text.split("\n");
    const blocks = [];
    let listItems = [];
    let listType = null;
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
      if (!line) { flushList(); continue; }
      const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
      if (numberedMatch) {
        if (listType && listType !== "ol") flushList();
        listType = "ol";
        listItems.push(`<li>${formatInline(numberedMatch[2])}</li>`);
        continue;
      }
      const bulletMatch = line.match(/^[-*\u2022]\s+(.+)/);
      if (bulletMatch) {
        if (listType && listType !== "ul") flushList();
        listType = "ul";
        listItems.push(`<li>${formatInline(bulletMatch[1])}</li>`);
        continue;
      }
      flushList();
      const boldHeaderMatch = line.match(/^\*\*(.+?)\*\*:?\s*$/);
      if (boldHeaderMatch) {
        blocks.push(`<div class="itt-details-subheader">${escapeHtml(boldHeaderMatch[1])}</div>`);
        continue;
      }
      const sectionMatch = line.match(/^(Claim\s+\d+|Overall|Conclusion|Summary|Analysis|Evidence|Verdict|Finding|Assessment|Result)\s*:\s*(.*)$/i);
      if (sectionMatch) {
        blocks.push(`<div class="itt-details-subheader">${escapeHtml(sectionMatch[1])}</div>`);
        if (sectionMatch[2].trim()) blocks.push(`<p>${formatInline(sectionMatch[2].trim())}</p>`);
        continue;
      }
      blocks.push(`<p>${formatInline(line)}</p>`);
    }
    flushList();
    return blocks.join("");
  }

  function buildTopicBadge(topicType) {
    const config = {
      political: { label: "Political", color: "#C4B5FD", bg: "rgba(139, 92, 246, 0.12)" },
      controversial: { label: "Controversial", color: "#FCD34D", bg: "rgba(245, 158, 11, 0.12)" },
      scientific: { label: "Scientific", color: "#67E8F9", bg: "rgba(8, 145, 178, 0.12)" },
      historical: { label: "Historical", color: "#FDE68A", bg: "rgba(146, 64, 14, 0.12)" },
      factual: { label: "Factual", color: "#6EE7B7", bg: "rgba(5, 150, 105, 0.12)" },
      other: { label: "", color: "", bg: "" }
    };
    const c = config[topicType] || config.other;
    if (!c.label) return "";
    return `<span class="itt-topic-badge" style="background: ${c.bg}; color: ${c.color}; border: 1px solid ${c.color}25;">${c.label}</span>`;
  }

  function buildPerspectivesHTML(perspectives) {
    if (!perspectives || !Array.isArray(perspectives) || perspectives.length === 0) return "";
    const blocks = perspectives.map(p => {
      if (!p || !p.side) return "";
      return `<div class="itt-perspective-block"><div class="itt-perspective-side">${escapeHtml(p.side)}</div><div class="itt-perspective-summary">${escapeHtml(p.summary || "")}</div></div>`;
    }).filter(Boolean).join("");
    if (!blocks) return "";
    return `<div class="itt-perspectives-section">
      <button class="itt-perspectives-toggle">Multiple Perspectives (${perspectives.length})<span class="itt-chevron">&#9660;</span></button>
      <div class="itt-perspectives-content">${blocks}</div>
    </div>`;
  }

  function buildLeanTag(lean) {
    const config = {
      "left": { label: "Left", color: "#60A5FA", bg: "rgba(37, 99, 235, 0.12)" },
      "center-left": { label: "Center-Left", color: "#93C5FD", bg: "rgba(59, 130, 246, 0.10)" },
      "center": { label: "Center", color: "#C4B5FD", bg: "rgba(139, 92, 246, 0.10)" },
      "center-right": { label: "Center-Right", color: "#FCA5A5", bg: "rgba(220, 38, 38, 0.10)" },
      "right": { label: "Right", color: "#F87171", bg: "rgba(220, 38, 38, 0.12)" },
      "nonpartisan": { label: "Nonpartisan", color: "#6EE7B7", bg: "rgba(5, 150, 105, 0.10)" }
    };
    const c = config[lean] || { label: lean || "Unknown", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.10)" };
    return `<span class="itt-lean-tag" style="background: ${c.bg}; color: ${c.color}; border-color: ${c.color}25;">${c.label}</span>`;
  }

  function buildSourcesHTML(result) {
    const jsonSources = result.sources || [];
    const annotationItems = [];
    for (const src of jsonSources) {
      if (!src) continue;
      if (typeof src === "object" && src.name) {
        annotationItems.push(`<div class="itt-source-item"><span class="itt-source-text">${escapeHtml(src.name)}</span>${buildLeanTag(src.lean)}</div>`);
      } else if (typeof src === "string" && src) {
        annotationItems.push(`<div class="itt-source-item"><span class="itt-source-text">${escapeHtml(src)}</span></div>`);
      }
    }
    if (annotationItems.length === 0) return "";
    return `<div class="itt-sources-section">
      <button class="itt-sources-toggle">Sources (${annotationItems.length})<span class="itt-chevron">&#9660;</span></button>
      <div class="itt-sources-content">
        <div class="itt-sources-group">
          <div class="itt-sources-group-label">Sources consulted</div>
          <div class="itt-sources-list">${annotationItems.join("")}</div>
        </div>
      </div>
    </div>`;
  }

  function buildResultHTML(type, content, result) {
    const vc = getVerdictConfig(result.verdict);
    const preview = type === "image"
      ? `<img src="${escapeHtml(content)}" class="itt-preview-img" />`
      : `<p class="itt-preview-text">"${escapeHtml(truncate(content, 150))}"</p>`;
    const corrections = result.corrections
      ? `<div class="itt-corrections"><div class="itt-corrections-title">Correction</div><div class="itt-corrections-body"><p>${formatInline(result.corrections)}</p></div></div>`
      : "";
    const logo = HEADER_LOGO_URL ? `<img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" />` : "";
    return `
      <div class="itt-inner">
        ${buildDragHandle()}
        <div class="itt-header">
          <div class="itt-header-brand">
            <div class="itt-logo-wrap">${logo}<div class="itt-logo-glow"></div></div>
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
            ${buildTopicBadge(result.topicType)}
          </div>
          ${buildConfidenceBar(result.confidence, vc.color)}
          <div class="itt-summary">${escapeHtml(result.summary)}</div>
          <div class="itt-details-section">
            <button class="itt-details-toggle">Show Details<span class="itt-chevron">&#9660;</span></button>
            <div class="itt-details-content">
              <div class="itt-details-body">${formatDetails(result.details)}</div>
              ${corrections}
            </div>
          </div>
          ${buildPerspectivesHTML(result.perspectives)}
          ${buildSourcesHTML(result)}
        </div>
      </div>`;
  }

  function buildAiImageResultHTML(content, result) {
    const vc = getAiVerdictConfig(result.verdict);
    const likelihood = Math.min(100, Math.max(0, Number(result.aiGeneratedLikelihood) || 0));
    const logo = HEADER_LOGO_URL ? `<img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" />` : "";
    return `
      <div class="itt-inner">
        ${buildDragHandle()}
        <div class="itt-header">
          <div class="itt-header-brand">
            <div class="itt-logo-wrap">${logo}<div class="itt-logo-glow"></div></div>
            <div class="itt-header-text">
              <span class="itt-header-title">Is This True?</span>
              <span class="itt-header-tagline">AI-generated image check</span>
            </div>
          </div>
          <button class="itt-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="itt-body">
          <img src="${escapeHtml(content)}" class="itt-preview-img" />
          <div class="itt-verdict-row">
            <div class="itt-verdict-badge" style="background: ${vc.bg}; color: ${vc.color}; border: 1px solid ${vc.color}30;">
              <span class="itt-verdict-icon">${vc.icon}</span>
              <span class="itt-verdict-label">${vc.label}</span>
            </div>
          </div>
          <div class="itt-confidence-wrap">
            <div class="itt-confidence-label">
              <span>AI-generated likelihood</span>
              <span class="itt-confidence-value">${likelihood}%</span>
            </div>
            <div class="itt-confidence-track">
              <div class="itt-confidence-fill" style="width: ${likelihood}%; background: linear-gradient(90deg, ${vc.color}, ${vc.color}CC);"></div>
            </div>
          </div>
          <div class="itt-summary">${escapeHtml(result.summary || result.details || "")}</div>
        </div>
      </div>`;
  }

  function buildErrorHTML(error) {
    const logo = HEADER_LOGO_URL ? `<img src="${escapeHtml(HEADER_LOGO_URL)}" class="itt-logo-img" alt="Is This True logo" />` : "";
    return `
      <div class="itt-inner">
        ${buildDragHandle()}
        <div class="itt-header">
          <div class="itt-header-brand">
            <div class="itt-logo-wrap">${logo}<div class="itt-logo-glow"></div></div>
            <div class="itt-header-text">
              <span class="itt-header-title">Is This True?</span>
              <span class="itt-header-tagline">Robust truth verification</span>
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
      </div>`;
  }

  function init() {
    if (window.electronAPI && window.electronAPI.getIconPath) {
      window.electronAPI.getIconPath().then((url) => { HEADER_LOGO_URL = url; });
    }
    initMessageListener();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
