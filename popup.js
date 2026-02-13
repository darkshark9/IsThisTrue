(() => {
  const fallbackLogoDataUri = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#475569"/></linearGradient></defs>' +
    '<rect x="6" y="6" width="116" height="116" rx="22" fill="url(#g)"/>' +
    '<text x="64" y="79" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="50" font-weight="700" fill="#ffffff">IT</text>' +
    "</svg>"
  );

  function applyLogoFallback() {
    const logo = document.querySelector(".logo-img");
    if (!logo) return;
    logo.addEventListener("error", () => {
      logo.src = fallbackLogoDataUri;
    }, { once: true });
    if (logo.complete && logo.naturalWidth === 0) {
      logo.src = fallbackLogoDataUri;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLogoFallback);
  } else {
    applyLogoFallback();
  }
})();
