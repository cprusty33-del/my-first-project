const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "MCL Audit Report Builder",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile("index.html");

  win.webContents.session.on("will-download", (event, item) => {
    const downloadsDir = path.join(os.homedir(), "Downloads");
    item.setSavePath(path.join(downloadsDir, item.getFilename()));
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
