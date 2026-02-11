// ============================================================
// Is This True? - Electron Main Process
// Snipping mode, overlay window, API orchestration
// ============================================================

const { app, BrowserWindow, ipcMain, globalShortcut, Tray, nativeImage, screen, Menu, systemPreferences, dialog } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const screenshot = require("screenshot-desktop");
const Jimp = require("jimp");
const {
  createRequestId,
  callWorker,
  parseGeminiResponse,
  applyAllSidesRatings,
  buildGroundingAnnotatedSources,
  mergeSourcesWithGrounding,
  calibrateConfidence
} = require("./api.js");

let mainWindow = null;
let overlayWindow = null;
let snippingWindows = [];
let tray = null;
let resultTargetWindow = null;

function getIconPath() {
  return path.join(__dirname, "icons", "icon128.png");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 375,
    height: 555,
    minWidth: 370,
    maxWidth: 370,
    minHeight: 400,
    show: false,
    frame: true,
    title: "Is This True?",
    icon: getIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    alwaysOnTop: false
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.on("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    return overlayWindow;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { width, height } = display.workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: display.bounds.x,
    y: display.bounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreen: false,
    fullscreenable: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // On macOS, use "screen-saver" level to appear above all windows including fullscreen apps.
  // Ensure overlay is visible on all Spaces (virtual desktops).
  if (process.platform === "darwin") {
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));
  overlayWindow.on("closed", () => { overlayWindow = null; });
  return overlayWindow;
}

function createSnippingWindows() {
  if (snippingWindows.length > 0) {
    snippingWindows.forEach(w => {
      if (!w.isDestroyed()) w.show();
    });
    return;
  }

  const displays = screen.getAllDisplays();
  displays.forEach(display => {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      enableLargerThanScreen: true,
      fullscreen: false,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, "snipping-preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // On macOS, use "screen-saver" level so snipping overlay appears above everything,
    // and make visible on all Spaces (virtual desktops).
    if (process.platform === "darwin") {
      win.setAlwaysOnTop(true, "screen-saver");
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    win.loadFile(path.join(__dirname, "snipping.html"));
    snippingWindows.push(win);
  });
}

function closeSnippingWindows() {
  snippingWindows.forEach(w => {
    if (w && !w.isDestroyed()) {
      w.close();
    }
  });
  snippingWindows = [];
}

function sendToRenderer(message) {
  const target = resultTargetWindow || mainWindow;
  if (target && !target.isDestroyed() && target.webContents) {
    target.webContents.send("itt-message", message);
  }
}

function sendProgress(stepIndex, steps, stepLabelOverride = null, stepDetail = null) {
  sendToRenderer({
    action: "updateProgress",
    currentStep: stepIndex,
    totalSteps: steps.length,
    stepLabel: stepLabelOverride || steps[stepIndex],
    stepDetail
  });
}

function startLiveProgressTicker(steps, stepIndex, labels, intervalMs = 3000) {
  if (!Array.isArray(labels) || labels.length === 0) return () => {};
  const startedAt = Date.now();
  let i = 0;
  sendProgress(stepIndex, steps, labels[0], "Starting source cross-check...");
  const timer = setInterval(() => {
    i += 1;
    const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    sendProgress(stepIndex, steps, labels[i % labels.length], `Still working... ${elapsedSec}s elapsed`);
  }, intervalMs);
  return () => clearInterval(timer);
}

function getIconUrl() {
  return pathToFileURL(getIconPath()).href;
}

async function handleTextCheck(text) {
  const requestId = createRequestId("text");
  const steps = ["Analyzing claim", "Searching the web", "Cross-referencing sources", "Generating verdict"];

  sendToRenderer({ action: "showLoading", type: "text", content: text, steps, currentStep: 0, iconUrl: getIconUrl() });

  let crossRefTimer = null;
  let tickerTimer = null;
  let stopTicker = () => {};
  try {
    sendProgress(1, steps);
    crossRefTimer = setTimeout(() => {
      sendProgress(2, steps, "Cross-referencing sources", "Comparing claims across sources...");
    }, 4000);
    tickerTimer = setTimeout(() => {
      stopTicker = startLiveProgressTicker(steps, 2, [
        "Cross-referencing sources", "Extracting key claims", "Comparing evidence consistency",
        "Checking date/context relevance", "Reconciling conflicting reports"
      ], 3000);
    }, 7000);

    const workerResult = await callWorker({ type: "text", text }, requestId);
    clearTimeout(crossRefTimer);
    clearTimeout(tickerTimer);
    stopTicker();

    sendProgress(3, steps, "Generating verdict", "Formatting final result...");
    const parsed = parseGeminiResponse(workerResult.response);
    parsed.groundingSources = workerResult.groundingSources || [];
    parsed.sources = mergeSourcesWithGrounding(
      parsed.sources,
      buildGroundingAnnotatedSources(parsed.groundingSources)
    );
    parsed.sources = applyAllSidesRatings(parsed.sources);
    parsed.confidence = calibrateConfidence(parsed, parsed.groundingSources);
    await new Promise(r => setTimeout(r, 500));

    sendToRenderer({ action: "showResult", type: "text", content: text, result: parsed, iconUrl: getIconUrl() });
  } catch (error) {
    sendToRenderer({ action: "showError", error: `Error: ${error.message}`, iconUrl: getIconUrl() });
  } finally {
    resultTargetWindow = null;
    if (crossRefTimer) clearTimeout(crossRefTimer);
    if (tickerTimer) clearTimeout(tickerTimer);
    stopTicker();
  }
}

async function handleImageCheck(imageUrl) {
  const requestId = createRequestId("image");
  const steps = ["Analyzing image", "Searching the web", "Cross-referencing sources", "Generating verdict"];

  sendToRenderer({ action: "showLoading", type: "image", content: imageUrl, steps, currentStep: 0, iconUrl: getIconUrl() });

  let crossRefTimer = null;
  let tickerTimer = null;
  let stopTicker = () => {};
  try {
    sendProgress(1, steps);
    crossRefTimer = setTimeout(() => {
      sendProgress(2, steps, "Cross-referencing sources", "Running grounded web verification...");
    }, 5000);
    tickerTimer = setTimeout(() => {
      stopTicker = startLiveProgressTicker(steps, 2, [
        "Cross-referencing sources", "Extracting text from image context",
        "Matching claims against web results", "Checking source credibility mix",
        "Validating contradictory evidence"
      ], 3000);
    }, 8000);

    const workerResult = await callWorker({ type: "image", imageUrl }, requestId);
    clearTimeout(crossRefTimer);
    clearTimeout(tickerTimer);
    stopTicker();

    sendProgress(3, steps, "Generating verdict", "Finalizing structured output...");
    const parsed = parseGeminiResponse(workerResult.response);
    parsed.groundingSources = workerResult.groundingSources || [];
    parsed.sources = mergeSourcesWithGrounding(
      parsed.sources,
      buildGroundingAnnotatedSources(parsed.groundingSources)
    );
    parsed.sources = applyAllSidesRatings(parsed.sources);
    parsed.confidence = calibrateConfidence(parsed, parsed.groundingSources);
    await new Promise(r => setTimeout(r, 500));

    sendToRenderer({ action: "showResult", type: "image", content: imageUrl, result: parsed, iconUrl: getIconUrl() });
  } catch (error) {
    sendToRenderer({ action: "showError", error: `Error: ${error.message}`, iconUrl: getIconUrl() });
  } finally {
    resultTargetWindow = null;
    if (crossRefTimer) clearTimeout(crossRefTimer);
    if (tickerTimer) clearTimeout(tickerTimer);
    stopTicker();
  }
}

async function captureRegionAsBase64(rect) {
  const { x, y, width, height } = rect;
  const display = screen.getDisplayMatching({ x, y, width, height });
  const bounds = display.bounds;
  let fullBuffer;
  try {
    const displays = await screenshot.listDisplays();
    const allDisplays = screen.getAllDisplays();
    const displayIndex = allDisplays.findIndex(d => d.id === display.id);
    const screenId = (displayIndex >= 0 && displays[displayIndex]) ? displays[displayIndex].id : (displays[0] && displays[0].id);
    fullBuffer = await screenshot({ screen: screenId, format: "png" });
  } catch {
    fullBuffer = await screenshot({ format: "png" });
  }
  const img = await Jimp.read(fullBuffer);

  // Compute actual scale factor from the captured image vs logical display bounds.
  // On macOS Retina (scaleFactor=2), the screenshot is at physical resolution (e.g. 3840x2400)
  // while all coordinates (mouse events, display.bounds) are in logical pixels (e.g. 1920x1200).
  // On Windows at 100% scaling, sf will be 1. This also handles Windows HiDPI correctly.
  const sf = display.bounds.width > 0 ? (img.bitmap.width / display.bounds.width) : 1;

  const cropX = Math.max(0, Math.round((x - bounds.x) * sf));
  const cropY = Math.max(0, Math.round((y - bounds.y) * sf));
  const cropW = Math.min(Math.round(width * sf), img.bitmap.width - cropX);
  const cropH = Math.min(Math.round(height * sf), img.bitmap.height - cropY);
  if (cropW <= 0 || cropH <= 0) {
    throw new Error("Invalid capture region");
  }
  const cropped = img.crop(cropX, cropY, cropW, cropH);
  const base64 = await cropped.getBase64Async(Jimp.MIME_PNG);
  return "data:image/png;base64," + (base64.replace ? base64.replace(/^data:image\/\w+;base64,/, "") : base64);
}

function checkScreenCapturePermission() {
  if (process.platform !== "darwin") return true;
  try {
    const status = systemPreferences.getMediaAccessStatus("screen");
    if (status === "granted") return true;
    // "not-determined" means the user hasn't been prompted yet -- on macOS the system
    // may show its own prompt on first capture attempt, so we let it proceed.
    if (status === "not-determined") return true;
    // "denied" or "restricted" -- user explicitly denied or MDM restricted
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Screen Recording Permission Required",
      message: "Is This True? needs screen recording permission to capture screen regions.",
      detail: "Please open System Settings > Privacy & Security > Screen Recording and enable \"Is This True?\". You may need to restart the app after granting permission.",
      buttons: ["Open System Settings", "Cancel"],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        const { exec } = require("child_process");
        exec("open x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
      }
    });
    return false;
  } catch {
    // If the API isn't available (very old Electron), proceed and hope for the best
    return true;
  }
}

function triggerSnippingMode() {
  if (!checkScreenCapturePermission()) return;
  createSnippingWindows();
}

function createTray() {
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  // macOS menu bar icons are typically 22x22; Windows system tray uses 16x16
  const traySize = process.platform === "darwin" ? 22 : 16;
  const trayIcon = icon.resize({ width: traySize, height: traySize });
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  tray.setToolTip("Is This True? - Snipping: " + (process.platform === "darwin" ? "Cmd+Shift+X" : "Ctrl+Shift+X"));

  // On macOS, left-clicking a tray icon with a context menu shows the menu,
  // so click/double-click handlers to toggle the window would conflict.
  // On Windows, click toggles visibility and context menu is right-click only.
  if (process.platform !== "darwin") {
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      } else {
        createWindow();
      }
    });
    tray.on("double-click", () => {
      if (mainWindow) mainWindow.show();
      else createWindow();
    });
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Is This True?", click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { label: "Snip Region", click: () => { triggerSnippingMode(); } },
    { type: "separator" },
    { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  const hotkey = "CommandOrControl+Shift+X";
  globalShortcut.register(hotkey, () => {
    triggerSnippingMode();
  });

  ipcMain.on("itt-snipping-capture", async (event, rect) => {
    closeSnippingWindows();
    const win = createOverlayWindow();
    resultTargetWindow = overlayWindow;
    const runCheck = (dataUrl) => {
      handleImageCheck(dataUrl);
    };
    const showErr = (msg) => {
      sendToRenderer({ action: "showError", error: msg, iconUrl: getIconUrl() });
      resultTargetWindow = null;
    };
    try {
      const dataUrl = await captureRegionAsBase64(rect);
      if (win.webContents.isLoading()) {
        win.webContents.once("did-finish-load", () => runCheck(dataUrl));
      } else {
        runCheck(dataUrl);
      }
    } catch (err) {
      if (win.webContents.isLoading()) {
        win.webContents.once("did-finish-load", () => showErr(`Capture failed: ${err.message}`));
      } else {
        showErr(`Capture failed: ${err.message}`);
      }
    }
  });

  ipcMain.on("itt-snipping-cancel", () => {
    closeSnippingWindows();
  });

  ipcMain.on("itt-overlay-close", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
  });

  ipcMain.on("itt-set-ignore-mouse-events", (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  ipcMain.handle("itt-get-icon-path", () => path.join(__dirname, "icons", "icon128.png"));
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (tray) tray.destroy();
  tray = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
  else if (mainWindow) mainWindow.show();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
