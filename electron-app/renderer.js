// ============================================================
// Is This True? - Electron Renderer
// Standalone UI: dropzone, panel container, IPC message handling
// ============================================================

(function () {
  const PANEL_ID = "isThisTrue-panel";
  const CONTAINER_ID = "isThisTrue-panel-container";
  let HEADER_LOGO_URL = "";

  const container = () => document.getElementById(CONTAINER_ID);

  function isMobileLayout() {
    return window.innerWidth <= 480;
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0 ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  }

  // --- Message handling (from main via preload) ---

  function initMessageListener() {
    window.electronAPI.onMessage((message) => {
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
    cnt.appendChild(panel);

    const closeBtn = panel.querySelector(".itt-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", () => removePanel());

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
      if (deltaY > 100) removePanel();
      else {
        panel.style.transform = "";
        requestAnimationFrame(() => panel.classList.add("itt-visible"));
      }
    }
    triggers.forEach(t => t.addEventListener("touchstart", onTouchStart, { passive: true }));
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    panel.__ittCleanup = () => {
      triggers.forEach(t => t.removeEventListener("touchstart", onTouchStart));
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
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

  function buildAiDisclaimerTooltip() {
    return `
      <span class="itt-ai-disclaimer">
        <button class="itt-ai-disclaimer-trigger" type="button" aria-label="AI detection disclaimer">?</button>
        <span class="itt-ai-disclaimer-tooltip" role="note">
          AI image checks are provided by a third-party detection service and can be wrong. Treat this as a signal, not proof.
        </span>
      </span>
    `;
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
              <span>AI-generated likelihood ${buildAiDisclaimerTooltip()}</span>
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

  // --- Dropzone and actions ---

  function runCheck() {
    const input = document.getElementById("isThisTrue-input");
    const text = input && input.value ? input.value.trim() : "";
    if (text.length > 3) {
      window.electronAPI.checkText(text);
    } else {
      showPanel(buildErrorHTML("Enter or paste at least a few characters to check."));
    }
  }

  function setupDropzone() {
    const dropzone = document.getElementById("isThisTrue-dropzone");
    const input = document.getElementById("isThisTrue-input");
    const checkBtn = document.getElementById("isThisTrue-check-btn");
    const pinCheckbox = document.getElementById("isThisTrue-pin");

    if (checkBtn) checkBtn.addEventListener("click", runCheck);
    if (pinCheckbox) {
      pinCheckbox.addEventListener("change", () => {
        window.electronAPI.setAlwaysOnTop(pinCheckbox.checked);
      });
    }

    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("itt-dropzone-active"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("itt-dropzone-active"));
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("itt-dropzone-active");
        const files = e.dataTransfer && e.dataTransfer.files;
        const text = e.dataTransfer && e.dataTransfer.getData("text/plain");
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => window.electronAPI.checkImage(reader.result);
            reader.readAsDataURL(file);
          } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
            const r = new FileReader();
            r.onload = () => { if (input) input.value = r.result; runCheck(); };
            r.readAsText(file);
          }
        } else if (text && text.trim().length > 3) {
          if (input) input.value = text;
          window.electronAPI.checkText(text.trim());
        }
      });
    }

    document.addEventListener("paste", (e) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => window.electronAPI.checkImage(reader.result);
            reader.readAsDataURL(blob);
          }
          e.preventDefault();
          return;
        }
      }
      const text = e.clipboardData.getData("text/plain");
      if (text && text.trim().length > 3 && input && document.activeElement === input) {
        input.value = text;
        runCheck();
        e.preventDefault();
      }
    });
  }

  function init() {
    window.electronAPI.getIconPath().then((url) => {
      HEADER_LOGO_URL = url;
    });
    initMessageListener();
    setupDropzone();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
