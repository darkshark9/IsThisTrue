// ============================================================
// Is This True? - Preload (safe bridge to main process)
// ============================================================

const { contextBridge, ipcRenderer } = require("electron");
const { pathToFileURL } = require("url");

contextBridge.exposeInMainWorld("electronAPI", {
  onMessage: (callback) => {
    ipcRenderer.on("itt-message", (event, message) => callback(message));
  },
  checkText: (text) => ipcRenderer.send("itt-check-text", text),
  checkImage: (imageUrl) => ipcRenderer.send("itt-check-image", imageUrl),
  setAlwaysOnTop: (value) => ipcRenderer.send("itt-set-always-on-top", value),
  getIconPath: () => ipcRenderer.invoke("itt-get-icon-path").then(p => pathToFileURL(p).href)
});
