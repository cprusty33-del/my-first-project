const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");

const XLSX = require("xlsx");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const WordExtractor = require("word-extractor");

const PRODUCT_NAME = "MCL Audit Report Builder";
const MAX_EXTRACT_CHARS = 20000;

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

function capText(text) {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EXTRACT_CHARS) return trimmed;
  return trimmed.slice(0, MAX_EXTRACT_CHARS) + "\n… (truncated, file is longer)";
}

function extractExcelText(fullPath) {
  const wb = XLSX.readFile(fullPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return "";
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const lines = [];
  for (const row of rows) {
    const cells = row.map((c) => String(c == null ? "" : c).trim()).filter(Boolean);
    if (cells.length) lines.push(cells.join("  |  "));
  }
  return lines.join("\n");
}

async function extractDocxText(fullPath) {
  const result = await mammoth.extractRawText({ path: fullPath });
  return (result.value || "").trim();
}

async function extractDocText(fullPath) {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(fullPath);
  return (doc.getBody() || "").trim();
}

async function extractPdfText(fullPath) {
  const buf = await fsp.readFile(fullPath);
  const data = await pdfParse(buf);
  return (data.text || "").trim();
}

// Best-effort text extraction: never throws, returns null on any failure
// or unsupported type so a bad/locked file just skips text extraction
// (the file is still attached either way).
async function extractText(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  try {
    let text = "";
    if ([".xlsx", ".xls", ".xlsm", ".csv"].includes(ext)) {
      text = extractExcelText(fullPath);
    } else if (ext === ".docx") {
      text = await extractDocxText(fullPath);
    } else if (ext === ".doc") {
      text = await extractDocText(fullPath);
    } else if (ext === ".pdf") {
      text = await extractPdfText(fullPath);
    } else {
      return null;
    }
    return text ? capText(text) : null;
  } catch (e) {
    return null;
  }
}

ipcMain.handle("attachments:add", async (event, ctx) => {
  const { area, period, ref } = ctx || {};
  const parentWin = BrowserWindow.fromWebContents(event.sender);
  if (parentWin) parentWin.focus();
  const result = await dialog.showOpenDialog(parentWin, {
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
    const text = await extractText(dest);
    added.push({
      name: path.basename(dest),
      relPath: path.relative(attachmentsRoot(), dest),
      size: stat.size,
      addedAt: new Date().toISOString(),
      text,
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
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
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
