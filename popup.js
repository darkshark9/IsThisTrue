// ============================================================
// Is This True? - Popup Script
// Detects platform and shows appropriate instructions
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Detect if this is likely a mobile/touch environment
  // Some mobile Chromium browsers (Kiwi, Yandex) support extensions
  const isTouchPrimary =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const isNarrow = window.innerWidth < 400;

  // If touch-primary device, ensure mobile instructions are shown
  // (CSS media query handles most cases, this is a JS fallback)
  if (isTouchPrimary || isNarrow) {
    const desktopInstructions = document.querySelectorAll(".desktop-instruction");
    const mobileInstructions = document.querySelectorAll(".mobile-instruction");

    desktopInstructions.forEach((el) => (el.style.display = "none"));
    mobileInstructions.forEach((el) => (el.style.display = "block"));
  }
});
