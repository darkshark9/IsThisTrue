const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  snippingCapture: (rect) => ipcRenderer.send("itt-snipping-capture", rect),
  snippingCancel: () => ipcRenderer.send("itt-snipping-cancel")
});
