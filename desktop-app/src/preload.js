const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("attachments", {
  add: (ctx) => ipcRenderer.invoke("attachments:add", ctx),
  open: (relPath) => ipcRenderer.invoke("attachments:open", relPath),
  remove: (relPath) => ipcRenderer.invoke("attachments:remove", relPath),
});

contextBridge.exposeInMainWorld("reportIO", {
  saveDocx: (ctx) => ipcRenderer.invoke("report:saveDocx", ctx),
  saveXlsx: (ctx) => ipcRenderer.invoke("report:saveXlsx", ctx),
  copyHtml: (ctx) => ipcRenderer.invoke("report:copyHtml", ctx),
});
