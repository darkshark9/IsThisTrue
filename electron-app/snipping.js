// ============================================================
// Is This True? - Snipping overlay: draw region, send to main
// ============================================================

(function () {
  const hint = document.getElementById("snipping-hint");
  const rectEl = document.getElementById("snipping-rect");
  const cancelBtn = document.getElementById("snipping-cancel");

  let startX = 0, startY = 0;
  let isDrawing = false;

  function setRect(left, top, width, height) {
    rectEl.style.left = (left - window.screenX) + "px";
    rectEl.style.top = (top - window.screenY) + "px";
    rectEl.style.width = Math.max(1, width) + "px";
    rectEl.style.height = Math.max(1, height) + "px";
    rectEl.style.display = "block";
  }

  function hideRect() {
    rectEl.style.display = "none";
  }

  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDrawing = true;
    startX = e.screenX;
    startY = e.screenY;
    setRect(startX, startY, 0, 0);
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const x = Math.min(startX, e.screenX);
    const y = Math.min(startY, e.screenY);
    const w = Math.abs(e.screenX - startX);
    const h = Math.abs(e.screenY - startY);
    setRect(x, y, w, h);
  });

  document.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || !isDrawing) return;
    isDrawing = false;
    const x = Math.min(startX, e.screenX);
    const y = Math.min(startY, e.screenY);
    const w = Math.abs(e.screenX - startX);
    const h = Math.abs(e.screenY - startY);
    if (w >= 10 && h >= 10) {
      if (window.electronAPI && window.electronAPI.snippingCapture) {
        window.electronAPI.snippingCapture({ x, y, width: w, height: h });
      }
    }
    hideRect();
  });

  cancelBtn.addEventListener("click", () => {
    if (window.electronAPI && window.electronAPI.snippingCancel) {
      window.electronAPI.snippingCancel();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (window.electronAPI && window.electronAPI.snippingCancel) {
        window.electronAPI.snippingCancel();
      }
    }
  });
})();
