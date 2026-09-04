const { app, BrowserWindow, dialog, ipcMain, shell, clipboard } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");

const XLSX = require("xlsx");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const WordExtractor = require("word-extractor");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
  AlignmentType,
} = require("docx");

// Light-only palette for exported Word/Excel reports (no blue, nothing dark).
const DOCX_CREAM = "FBF6EC";
const DOCX_INK = "3A3A3A";
const DOCX_RULE = "D9CBB8";

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

function sheetToText(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const lines = [];
  for (const row of rows) {
    const cells = row.map((c) => String(c == null ? "" : c).trim()).filter(Boolean);
    if (cells.length) lines.push(cells.join("  |  "));
  }
  return lines.join("\n");
}

// MCL's audit annexure templates have a header row ending "...Exception,
// Remarks" and their own stated rule: "Each EXCEPTION line becomes an
// Observation; this sheet is its cited Annexure." When a sheet matches that
// template, transcribe only the rows literally marked EXCEPTION into plain
// sentences built from that row's own column headers and values (no
// interpretation, nothing invented) instead of dumping the whole sheet.
// Returns null when the sheet doesn't have a recognizable "Exception" column,
// so the caller can fall back to a raw dump for sheets that aren't this
// template.
function sheetToObservationText(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  let headerIdx = -1;
  let headerRow = null;
  let exceptionCol = -1;
  for (let i = 0; i < rows.length; i++) {
    const col = rows[i].findIndex((h) => String(h || "").trim().toLowerCase() === "exception");
    if (col !== -1) {
      headerIdx = i;
      headerRow = rows[i];
      exceptionCol = col;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const sentences = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some((c) => String(c == null ? "" : c).trim() !== "")) continue;
    const first = String(row[0] || "").trim().toLowerCase();
    if (first === "total") continue;
    if (first.startsWith("legend")) break;
    const flag = String(row[exceptionCol] || "").trim().toUpperCase();
    if (flag !== "EXCEPTION") continue;
    const parts = [];
    for (let c = 0; c < headerRow.length; c++) {
      if (c === exceptionCol) continue;
      const label = String(headerRow[c] || "").trim();
      if (!label || label.toLowerCase() === "sl") continue;
      const val = row[c];
      const valStr = val instanceof Date ? val.toLocaleDateString() : String(val == null ? "" : val).trim();
      if (!valStr) continue;
      parts.push(label + ": " + valStr);
    }
    if (parts.length) sentences.push(parts.join("; ") + ".");
  }

  if (!sentences.length) {
    return { text: "No rows marked EXCEPTION in this annexure sheet (all items within norms or not yet marked).", hasException: false };
  }
  return {
    text: sentences.length === 1 ? sentences[0] : sentences.map((s, i) => i + 1 + ") " + s).join("\n"),
    hasException: true,
  };
}

function extractExcelText(fullPath) {
  const wb = XLSX.readFile(fullPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { text: "", hasException: false };
  const sheet = wb.Sheets[sheetName];
  const obs = sheetToObservationText(sheet);
  return obs || { text: sheetToText(sheet), hasException: false };
}

// Strips everything but letters/digits and lowercases, so "1.1.2. (a)" and
// "1.1.2a" compare equal when matching an annexure sheet name to a scope ref.
function normalizeRef(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Copies a source file into a per-point attachment directory, avoiding name
// collisions, and returns its metadata (without extracted text).
async function copyIntoAttachmentDir(area, period, ref, srcPath) {
  const dir = path.join(attachmentsRoot(), sanitizeSegment(area), sanitizeSegment(period), sanitizeSegment(ref));
  await fsp.mkdir(dir, { recursive: true });
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
  return {
    name: path.basename(dest),
    relPath: path.relative(attachmentsRoot(), dest),
    size: stat.size,
    addedAt: new Date().toISOString(),
  };
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
    if ([".xlsx", ".xls", ".xlsm", ".csv"].includes(ext)) {
      const { text, hasException } = extractExcelText(fullPath);
      return text ? { text: capText(text), hasException } : null;
    } else if (ext === ".docx") {
      const text = await extractDocxText(fullPath);
      return text ? { text: capText(text), hasException: false } : null;
    } else if (ext === ".doc") {
      const text = await extractDocText(fullPath);
      return text ? { text: capText(text), hasException: false } : null;
    } else if (ext === ".pdf") {
      const text = await extractPdfText(fullPath);
      return text ? { text: capText(text), hasException: false } : null;
    }
    return null;
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

  const added = [];
  for (const srcPath of result.filePaths) {
    const meta = await copyIntoAttachmentDir(area, period, ref, srcPath);
    const full = resolveAttachmentPath(meta.relPath);
    const extracted = await extractText(full);
    added.push({ ...meta, text: extracted ? extracted.text : null, hasException: extracted ? extracted.hasException : false });
  }
  return added;
});

// Bulk-loads a batch of Excel annexure workbooks (like MCL's per-section
// annexures, one sheet per audit point) and auto-distributes each sheet's
// content to the scope point whose ref matches that sheet's name — e.g. a
// sheet named "1.1.2a OC Coal Deptl" matches ref "1.1.2. (a)". Only exact
// normalized-ref matches are used; anything that doesn't match a ref in the
// current coverage list is reported back as unmatched rather than guessed.
ipcMain.handle("annexures:bulkAdd", async (event, ctx) => {
  const { area, period, refs } = ctx || {};
  const parentWin = BrowserWindow.fromWebContents(event.sender);
  if (parentWin) parentWin.focus();
  const result = await dialog.showOpenDialog(parentWin, {
    title: "Select Excel annexure files (one sheet per audit point)",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Excel files", extensions: ["xlsx", "xls", "xlsm"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return { byRef: {}, unmatched: [], filesProcessed: 0 };

  const refByNorm = new Map();
  for (const ref of refs || []) {
    const norm = normalizeRef(ref);
    if (!norm) continue;
    if (!refByNorm.has(norm)) refByNorm.set(norm, []);
    refByNorm.get(norm).push(ref);
  }

  const byRef = {};
  const unmatched = [];
  for (const srcPath of result.filePaths) {
    const fileBase = path.basename(srcPath);
    let wb;
    try {
      wb = XLSX.readFile(srcPath);
    } catch (e) {
      unmatched.push({ file: fileBase, sheet: null, reason: "could not open file: " + String(e) });
      continue;
    }
    for (const sheetName of wb.SheetNames) {
      if (/^index$/i.test(sheetName.trim())) continue;
      const leadingToken = sheetName.trim().split(/\s+/)[0];
      if (!/^\d/.test(leadingToken)) {
        unmatched.push({ file: fileBase, sheet: sheetName, reason: "sheet name doesn't start with a point number" });
        continue;
      }
      const norm = normalizeRef(leadingToken);
      const matchedRefs = refByNorm.get(norm);
      if (!matchedRefs || !matchedRefs.length) {
        unmatched.push({ file: fileBase, sheet: sheetName, reason: "no scope point matches \"" + leadingToken + "\"" });
        continue;
      }
      const sheet = wb.Sheets[sheetName];
      const obs = sheetToObservationText(sheet);
      const text = capText(obs ? obs.text : sheetToText(sheet));
      const hasException = obs ? obs.hasException : false;
      for (const ref of matchedRefs) {
        const meta = await copyIntoAttachmentDir(area, period, ref, srcPath);
        const record = { ...meta, name: fileBase + " — " + sheetName, text, hasException };
        if (!byRef[ref]) byRef[ref] = [];
        byRef[ref].push(record);
      }
    }
  }
  return { byRef, unmatched, filesProcessed: result.filePaths.length };
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

// Saves report content via a native Save dialog (defaulting to the
// Downloads folder) instead of the browser blob/anchor download path,
// which is unreliable to trigger from a packaged Electron app.
function docxHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: DOCX_CREAM },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, color: DOCX_INK })] })],
  });
}
function docxCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { line: 260 }, children: [new TextRun({ text: text || "", size: 18, color: DOCX_INK })] })],
  });
}
function docxTable(headers, widths, rows) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
    },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => docxHeaderCell(h, widths[i])) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => docxCell(c, widths[i])) })),
    ],
  });
}

function buildReportDocx({ area, periodLabel, coverage, thematic }) {
  const coverageWidths = [900, 3000, 3000, 2450];
  const thematicWidths = [500, 2400, 2150, 2150, 2150];
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: "C K PRUSTY & ASSOCIATES, Chartered Accountants", bold: true, size: 26, color: DOCX_INK })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: "Internal Audit — " + area + ", MCL · " + periodLabel, size: 20, color: DOCX_INK })],
          }),
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [new TextRun({ text: "A. Scope-Coverage Statement", bold: true, size: 24, color: DOCX_INK })],
          }),
          docxTable(["Sl No", "Scope of Work", "Observation", "Management Reply"], coverageWidths, coverage.map((r) => [r.ref, r.title, r.observation, r.reply])),
          new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: "B. Report of Exception — 25 Points", bold: true, size: 24, color: DOCX_INK })],
          }),
          docxTable(["Sl", "Description", "Problem", "Auditor's Comment", "Management Comment"], thematicWidths, thematic.map((r) => [r.ref, r.desc, r.prob, r.aud, r.mgmt])),
          new Paragraph({
            spacing: { before: 240 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE, space: 4 } },
            children: [
              new TextRun({
                text: "Non-Assumption / Non-Hallucination Certificate: All observations and figures are entered by the auditor from management-supplied records. No figures have been assumed or invented.",
                italics: true,
                size: 16,
                color: DOCX_INK,
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function buildReportXlsx({ area, periodLabel, coverage, thematic }) {
  const wb = XLSX.utils.book_new();

  const coverageHeader = ["Sl No", "Scope of Work", "Observation", "Management Reply"];
  const coverageAoa = [
    ["C K PRUSTY & ASSOCIATES, Chartered Accountants"],
    ["Internal Audit — " + area + ", MCL · " + periodLabel],
    [],
    coverageHeader,
    ...coverage.map((r) => [r.ref, r.title, r.observation, r.reply]),
  ];
  const wsCoverage = XLSX.utils.aoa_to_sheet(coverageAoa);
  wsCoverage["!cols"] = [{ wch: 12 }, { wch: 45 }, { wch: 45 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsCoverage, "Scope Coverage");

  const thematicHeader = ["Sl", "Description", "Problem", "Auditor's Comment", "Management Comment"];
  const thematicAoa = [
    ["C K PRUSTY & ASSOCIATES, Chartered Accountants"],
    ["Internal Audit — " + area + ", MCL · " + periodLabel],
    [],
    thematicHeader,
    ...thematic.map((r) => [r.ref, r.desc, r.prob, r.aud, r.mgmt]),
  ];
  const wsThematic = XLSX.utils.aoa_to_sheet(thematicAoa);
  wsThematic["!cols"] = [{ wch: 8 }, { wch: 35 }, { wch: 35 }, { wch: 35 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsThematic, "25-Point Exceptions");

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

async function saveReportFile(event, ctx, ext, buildBuffer) {
  const parentWin = BrowserWindow.fromWebContents(event.sender);
  const fileBase = (ctx && ctx.fileBase) || "Report";
  const result = await dialog.showSaveDialog(parentWin, {
    title: "Save report",
    defaultPath: path.join(app.getPath("downloads"), fileBase + "." + ext),
    filters: [
      { name: ext.toUpperCase() + " file", extensions: [ext] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    const buffer = await buildBuffer(ctx);
    await fsp.writeFile(result.filePath, buffer);
    return { ok: true, filePath: result.filePath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

ipcMain.handle("report:saveDocx", (event, ctx) => saveReportFile(event, ctx, "docx", buildReportDocx));
ipcMain.handle("report:saveXlsx", (event, ctx) => saveReportFile(event, ctx, "xlsx", buildReportXlsx));

// Writes both HTML and plain-text clipboard formats via Electron's
// clipboard module, so pasting into Word/Excel/Outlook keeps the table
// structure (document.execCommand("copy") is deprecated and unreliable
// in newer Electron/Chromium).
ipcMain.handle("report:copyHtml", async (event, ctx) => {
  const { html, text } = ctx || {};
  try {
    clipboard.write({ html: html || "", text: text || "" });
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
