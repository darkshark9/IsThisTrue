const { contextBridge, ipcRenderer } = require("electron");
const { pathToFileURL } = require("url");

contextBridge.exposeInMainWorld("electronAPI", {
  onMessage: (callback) => {
    ipcRenderer.on("itt-message", (event, message) => callback(message));
  },
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send("itt-set-ignore-mouse-events", ignore, options),
  closeOverlay: () => ipcRenderer.send("itt-overlay-close"),
  getIconPath: () => ipcRenderer.invoke("itt-get-icon-path").then(p => pathToFileURL(p).href)
});
