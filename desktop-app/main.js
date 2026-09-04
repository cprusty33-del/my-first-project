const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const os = require("os");

const PRODUCT_NAME = "MCL Audit Report Builder";

// Surface any startup crash as a dialog instead of failing silently
// (a double-clicked GUI app has no console to print errors to).
process.on("uncaughtException", (err) => {
  try {
    dialog.showErrorBox(PRODUCT_NAME + " - Error", String(err && err.stack || err));
  } catch (e) {}
  app.exit(1);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: PRODUCT_NAME,
    icon: path.join(__dirname, "assets", "icon.ico"),
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
