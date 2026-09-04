const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");

const PRODUCT_NAME = "MCL Audit Report Builder";

// Surface any startup crash as a dialog instead of failing silently
// (a double-clicked GUI app has no console to print errors to).
process.on("uncaughtException", (err) => {
  try {
    dialog.showErrorBox(PRODUCT_NAME + " - Error", String(err && err.stack || err));
  } catch (e) {}
  app.exit(1);
});

function sanitizeSegment(s) {
  return String(s || "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "_";
}

function attachmentsRoot() {
  return path.join(app.getPath("userData"), "attachments");
}

// Resolve a stored relative path against the attachments root and refuse
// anything that would escape it (defence against a crafted relPath).
function resolveAttachmentPath(relPath) {
  const root = attachmentsRoot();
  const full = path.normalize(path.join(root, relPath));
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Invalid attachment path");
  }
  return full;
}

ipcMain.handle("attachments:add", async (event, ctx) => {
  const { area, period, ref } = ctx || {};
  const result = await dialog.showOpenDialog({
    title: "Select supporting files (PDF, Word, Excel)",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Documents", extensions: ["pdf", "doc", "docx", "xls", "xlsx", "xlsm", "csv"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return [];

  const dir = path.join(attachmentsRoot(), sanitizeSegment(area), sanitizeSegment(period), sanitizeSegment(ref));
  await fsp.mkdir(dir, { recursive: true });

  const added = [];
  for (const srcPath of result.filePaths) {
    const base = path.basename(srcPath);
    const ext = path.extname(base);
    const stem = path.basename(base, ext);
    let dest = path.join(dir, base);
    let i = 1;
    while (fs.existsSync(dest)) {
      dest = path.join(dir, `${stem} (${i})${ext}`);
      i++;
    }
    await fsp.copyFile(srcPath, dest);
    const stat = await fsp.stat(dest);
    added.push({
      name: path.basename(dest),
      relPath: path.relative(attachmentsRoot(), dest),
      size: stat.size,
      addedAt: new Date().toISOString(),
    });
  }
  return added;
});

ipcMain.handle("attachments:open", async (event, relPath) => {
  const full = resolveAttachmentPath(relPath);
  const err = await shell.openPath(full);
  return { ok: !err, error: err || null };
});

ipcMain.handle("attachments:remove", async (event, relPath) => {
  const full = resolveAttachmentPath(relPath);
  try {
    await fsp.unlink(full);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
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
