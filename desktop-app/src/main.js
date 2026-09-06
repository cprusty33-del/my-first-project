const { app, BrowserWindow, dialog, ipcMain, shell, clipboard } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");

const XLSX = require("xlsx");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const WordExtractor = require("word-extractor");
const { parse: parseHtml } = require("node-html-parser");
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
  PageOrientation,
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
// Observation; this sheet is its cited Annexure." When a grid matches that
// template, transcribe every row that either (a) is literally marked
// EXCEPTION, or (b) has a non-empty Remarks entry — auditors often note a
// genuine finding in Remarks (e.g. "Form-H not provided by management")
// without also flipping the Exception dropdown — into plain sentences built
// from that row's own column headers and values (no interpretation, nothing
// invented) instead of dumping everything. Returns null when the grid has no
// recognizable "Exception" column, so the caller can fall back to raw text.
//
// Takes a plain 2-D array so the same rule serves Excel sheets and Word
// tables alike.
function gridToObservation(rows) {
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
  const remarksCol = headerRow.findIndex((h) => String(h || "").trim().toLowerCase() === "remarks");

  // Fixed column set (used for the columnar table) — every non-blank header
  // except Sl and Exception, in their original sheet order.
  const columns = [];
  for (let c = 0; c < headerRow.length; c++) {
    if (c === exceptionCol) continue;
    const label = String(headerRow[c] || "").trim();
    if (!label || label.toLowerCase() === "sl") continue;
    columns.push({ c, label });
  }
  const formatVal = (val) => (val instanceof Date ? val.toLocaleDateString() : String(val == null ? "" : val).trim());

  let anyException = false;
  const sentences = [];
  const tableRows = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some((c) => String(c == null ? "" : c).trim() !== "")) continue;
    const first = String(row[0] || "").trim().toLowerCase();
    if (first === "total") continue;
    if (first.startsWith("legend")) break;
    const flag = String(row[exceptionCol] || "").trim().toUpperCase();
    const remark = remarksCol !== -1 ? String(row[remarksCol] == null ? "" : row[remarksCol]).trim() : "";
    if (flag === "EXCEPTION") anyException = true;
    if (flag !== "EXCEPTION" && !remark) continue;
    const cells = columns.map(({ c }) => formatVal(row[c]));
    if (cells.every((v) => !v)) continue;
    tableRows.push(cells);
    const parts = columns.map(({ label }, idx) => (cells[idx] ? label + ": " + cells[idx] : null)).filter(Boolean);
    if (parts.length) sentences.push(parts.join("\n"));
  }

  if (!sentences.length) {
    return { text: "No rows marked EXCEPTION or carrying a Remark in this annexure.", hasException: false, table: null };
  }
  return {
    text: sentences.length === 1 ? sentences[0] : sentences.map((s, i) => "Item " + (i + 1) + ":\n" + s).join("\n\n"),
    hasException: anyException,
    table: { headers: columns.map((c) => c.label), rows: tableRows },
  };
}

function sheetToObservationText(sheet) {
  return gridToObservation(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }));
}

function extractExcelText(fullPath) {
  const wb = XLSX.readFile(fullPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { text: "", hasException: false, table: null };
  const sheet = wb.Sheets[sheetName];
  const obs = sheetToObservationText(sheet);
  return obs || { text: sheetToText(sheet), hasException: false, table: null };
}

// Strips spacing/parentheses and folds a trailing ". (a)"-style suffix into
// "a", but keeps the dots between digit groups intact — stripping ALL
// punctuation would collapse distinct refs into the same key (e.g. "1.1.1"
// and "11.1" both became "111"), which could silently misfile a sheet's
// content into the wrong section.
function normalizeRef(s) {
  let t = String(s || "").toLowerCase().trim();
  t = t.replace(/\s+/g, "");
  t = t.replace(/[()]/g, "");
  t = t.replace(/\.([a-z])$/, "$1");
  return t;
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

// ---------------------------------------------------------------------------
// Word / PDF annexures
//
// Excel annexures carry one sheet per audit point, so the sheet name says
// which point a block of data belongs to. Word and PDF have no sheets, so the
// equivalent marker is the annexure's own heading line — MCL's template writes
// "Annexure 1.1.2a — ..." and "Scope 1.1.2a — ..." above each table. A
// document is split at those headings and each section is treated exactly like
// one Excel sheet. Only an explicit "Annexure"/"Scope" heading (or, in Word, a
// Heading-styled line starting with a point number) starts a section — a bare
// number in running text is never treated as one.
// ---------------------------------------------------------------------------

// Matched against a lowercased line, so [a-z] really means lowercase: the
// optional letter suffix must not swallow the first letter of the next word
// ("annexure 3.1 to report..." is ref 3.1, not "3.1t").
const REF_HEADING_RE = /^\s*(?:annexure|annex|scope)\s*(?:ref\.?)?\s*[:\-–—]?\s*(\d+(?:\.\d+)*\.?\s*(?:\(\s*[a-z]\s*\)|[a-z](?![a-z]))?)/;

function refFromHeading(line) {
  const m = String(line || "").toLowerCase().match(REF_HEADING_RE);
  return m ? m[1].trim() : null;
}

// A Word Heading-styled line such as "1.1.2a OC Coal Deptl" — explicit
// document structure, so a leading point number is enough here.
function refFromLeadingToken(line) {
  const token = String(line || "").trim().split(/\s+/)[0];
  return /^\d/.test(token) ? token : null;
}

function refFromFileName(fileBase) {
  const stem = path.basename(fileBase, path.extname(fileBase)).replace(/[_-]+/g, " ").toLowerCase();
  const m = stem.match(/(?:^|[^\d.])(\d+(?:\.\d+)+\s*(?:\(\s*[a-z]\s*\)|[a-z](?![a-z]))?)/);
  return m ? m[1].trim() : null;
}

// Reads a .docx into ordered blocks of text and real tables. mammoth's HTML
// keeps document order, so a table stays attached to the heading above it.
async function docxBlocks(fullPath) {
  const result = await mammoth.convertToHtml({ path: fullPath });
  const root = parseHtml(result.value || "");
  const blocks = [];
  for (const node of root.childNodes) {
    const tag = (node.tagName || "").toLowerCase();
    if (tag === "table") {
      const grid = [];
      for (const tr of node.querySelectorAll("tr")) {
        const cells = [];
        for (const cell of tr.childNodes) {
          const cellTag = (cell.tagName || "").toLowerCase();
          if (cellTag === "td" || cellTag === "th") cells.push(cell.text.replace(/\s+/g, " ").trim());
        }
        if (cells.length) grid.push(cells);
      }
      if (grid.length) blocks.push({ type: "table", grid });
    } else {
      const text = (node.text || "").replace(/[ \t]+/g, " ").trim();
      if (text) blocks.push({ type: "text", text, heading: /^h[1-6]$/.test(tag) });
    }
  }
  return blocks;
}

// Splits ordered Word blocks into one section per annexure heading.
function segmentDocxBlocks(blocks) {
  const segments = [];
  let current = null;
  for (const b of blocks) {
    let ref = null;
    if (b.type === "text") {
      ref = refFromHeading(b.text) || (b.heading ? refFromLeadingToken(b.text) : null);
    }
    if (ref && (!current || normalizeRef(current.ref) !== normalizeRef(ref))) {
      current = { ref, blocks: [] };
      segments.push(current);
    }
    if (current) current.blocks.push(b);
  }
  return segments;
}

// Same idea for plain text (PDF, legacy .doc), line by line.
function segmentPlainText(text) {
  const segments = [];
  let current = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const ref = refFromHeading(line);
    if (ref && (!current || normalizeRef(current.ref) !== normalizeRef(ref))) {
      current = { ref, lines: [] };
      segments.push(current);
    }
    if (current) current.lines.push(line);
  }
  if (segments.length) return segments.map((s) => ({ ref: s.ref, text: s.lines.join("\n").trim() }));
  // PDF text extraction does not always keep headings on their own line, so
  // fall back to scanning the whole document for the same explicit
  // "Annexure <point no.>" marker wherever it appears.
  return segmentRunningText(text);
}

const REF_INLINE_RE = /(?:annexure|annex|scope)\s*(?:ref\.?)?\s*[:\-–—]?\s*(\d+(?:\.\d+)*\.?\s*(?:\(\s*[a-z]\s*\)|[a-z](?![a-z]))?)/g;

function segmentRunningText(text) {
  const src = String(text || "");
  const lower = src.toLowerCase();
  const marks = [];
  REF_INLINE_RE.lastIndex = 0;
  let m;
  while ((m = REF_INLINE_RE.exec(lower)) !== null) {
    const ref = m[1].trim();
    if (!ref) continue;
    if (marks.length && normalizeRef(marks[marks.length - 1].ref) === normalizeRef(ref)) continue;
    marks.push({ ref, at: m.index });
  }
  return marks.map((mark, i) => ({
    ref: mark.ref,
    text: src.slice(mark.at, i + 1 < marks.length ? marks[i + 1].at : undefined).trim(),
  }));
}

// One Word section behaves like one Excel sheet: if it holds an annexure
// table (a grid with an "Exception" column) apply the same EXCEPTION/Remarks
// rule; otherwise fall back to that section's plain text.
function observationFromBlocks(blocks) {
  for (const b of blocks) {
    if (b.type !== "table") continue;
    const obs = gridToObservation(b.grid);
    if (obs) return obs;
  }
  const text = blocks
    .map((b) => (b.type === "table" ? b.grid.map((r) => r.filter(Boolean).join("  |  ")).join("\n") : b.text))
    .filter(Boolean)
    .join("\n")
    .trim();
  return { text, hasException: false, table: null };
}

async function extractDocxObservation(fullPath) {
  const blocks = await docxBlocks(fullPath);
  if (!blocks.length) return { text: "", hasException: false, table: null };
  return observationFromBlocks(blocks);
}

// Best-effort text extraction: never throws, returns null on any failure
// or unsupported type so a bad/locked file just skips text extraction
// (the file is still attached either way).
async function extractText(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  try {
    if ([".xlsx", ".xls", ".xlsm", ".csv"].includes(ext)) {
      const { text, hasException, table } = extractExcelText(fullPath);
      return text ? { text: capText(text), hasException, table } : null;
    } else if (ext === ".docx") {
      const { text, hasException, table } = await extractDocxObservation(fullPath);
      return text ? { text: capText(text), hasException, table } : null;
    } else if (ext === ".doc") {
      const text = await extractDocText(fullPath);
      return text ? { text: capText(text), hasException: false, table: null } : null;
    } else if (ext === ".pdf") {
      const text = await extractPdfText(fullPath);
      return text ? { text: capText(text), hasException: false, table: null } : null;
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
    added.push({ ...meta, text: extracted ? extracted.text : null, hasException: extracted ? extracted.hasException : false, table: extracted ? extracted.table : null });
  }
  return added;
});

// Splits one annexure file into "units" — the per-point pieces the bulk
// loader distributes. Excel gives one unit per sheet; Word and PDF give one
// unit per "Annexure <ref>" section. Each unit carries the point number it
// claims (refToken), a label for display, and the observation derived from it.
// Never resolves refs itself — the caller matches them against the live
// coverage list, so an unrecognized number is reported, never guessed.
async function parseAnnexureFile(srcPath) {
  const fileBase = path.basename(srcPath);
  const ext = path.extname(srcPath).toLowerCase();
  const units = [];
  const notes = [];

  if ([".xlsx", ".xls", ".xlsm"].includes(ext)) {
    const wb = XLSX.readFile(srcPath);
    for (const sheetName of wb.SheetNames) {
      if (/^index$/i.test(sheetName.trim())) continue;
      const leadingToken = sheetName.trim().split(/\s+/)[0];
      if (!/^\d/.test(leadingToken)) {
        notes.push({ label: sheetName, reason: "sheet name doesn't start with a point number" });
        continue;
      }
      const sheet = wb.Sheets[sheetName];
      const obs = sheetToObservationText(sheet);
      units.push({
        refToken: leadingToken,
        label: sheetName,
        text: obs ? obs.text : sheetToText(sheet),
        hasException: obs ? obs.hasException : false,
        table: obs ? obs.table : null,
      });
    }
    return { units, notes };
  }

  if (ext === ".docx") {
    const blocks = await docxBlocks(srcPath);
    for (const seg of segmentDocxBlocks(blocks)) {
      const obs = observationFromBlocks(seg.blocks);
      units.push({ refToken: seg.ref, label: "Annexure " + seg.ref, ...obs });
    }
    if (!units.length && blocks.length) {
      // No headings inside — fall back to a point number in the file name.
      const fileRef = refFromFileName(fileBase);
      if (fileRef) units.push({ refToken: fileRef, label: "whole document", ...observationFromBlocks(blocks) });
      else notes.push({ label: null, reason: 'no "Annexure <point no.>" heading found, and the file name has no point number' });
    }
    return { units, notes };
  }

  if (ext === ".pdf" || ext === ".doc") {
    const text = ext === ".pdf" ? await extractPdfText(srcPath) : await extractDocText(srcPath);
    if (!text) {
      notes.push({
        label: null,
        reason:
          ext === ".pdf"
            ? "no text found in this PDF — a scanned/image-only PDF needs OCR, which this app does not do"
            : "no text found in this document",
      });
      return { units, notes };
    }
    for (const seg of segmentPlainText(text)) {
      units.push({ refToken: seg.ref, label: "Annexure " + seg.ref, text: seg.text, hasException: false, table: null });
    }
    if (!units.length) {
      const fileRef = refFromFileName(fileBase);
      if (fileRef) units.push({ refToken: fileRef, label: "whole document", text, hasException: false, table: null });
      else notes.push({ label: null, reason: 'no "Annexure <point no.>" heading found, and the file name has no point number' });
    }
    return { units, notes };
  }

  notes.push({ label: null, reason: "unsupported file type (" + ext + ")" });
  return { units, notes };
}

// Resolves a point number claimed by a unit against the live coverage list.
// Tries the number exactly as written first; only if that matches nothing does
// it retry without a trailing letter (so "Annexure 2.6 (a)" can still reach
// point "2.6" when no "2.6a" exists). Returns [] when nothing matches.
function resolveRefs(refToken, refByNorm) {
  const exact = refByNorm.get(normalizeRef(refToken));
  if (exact && exact.length) return exact;
  const numericOnly = String(refToken).match(/^\s*(\d+(?:\.\d+)*)/);
  if (numericOnly) {
    const fallback = refByNorm.get(normalizeRef(numericOnly[1]));
    if (fallback && fallback.length) return fallback;
  }
  return [];
}

// Bulk-loads a batch of annexure files (Excel, Word or PDF) and distributes
// each per-point piece to the scope point whose ref it names — an Excel sheet
// named "1.1.2a OC Coal Deptl", or a Word/PDF section headed "Annexure
// 1.1.2a — ...", both match ref "1.1.2. (a)". Anything that doesn't match a
// ref in the current coverage list is reported back as unmatched, never
// guessed into the nearest point.
ipcMain.handle("annexures:bulkAdd", async (event, ctx) => {
  const { area, period, refs } = ctx || {};
  const parentWin = BrowserWindow.fromWebContents(event.sender);
  if (parentWin) parentWin.focus();
  const result = await dialog.showOpenDialog(parentWin, {
    title: "Select annexure files (Excel sheets, or Word/PDF with 'Annexure <point no.>' headings)",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Annexures (Excel, Word, PDF)", extensions: ["xlsx", "xls", "xlsm", "docx", "doc", "pdf"] },
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
    let parsed;
    try {
      parsed = await parseAnnexureFile(srcPath);
    } catch (e) {
      unmatched.push({ file: fileBase, sheet: null, reason: "could not read file: " + String(e) });
      continue;
    }
    parsed.notes.forEach((n) => unmatched.push({ file: fileBase, sheet: n.label, reason: n.reason }));
    for (const unit of parsed.units) {
      const matchedRefs = resolveRefs(unit.refToken, refByNorm);
      if (!matchedRefs.length) {
        unmatched.push({ file: fileBase, sheet: unit.label, reason: 'no scope point matches "' + unit.refToken + '"' });
        continue;
      }
      const text = capText(unit.text);
      for (const ref of matchedRefs) {
        const meta = await copyIntoAttachmentDir(area, period, ref, srcPath);
        const record = { ...meta, name: fileBase + " — " + unit.label, text, hasException: unit.hasException, table: unit.table };
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
  // A literal "\n" inside one TextRun does not create a line break in Word —
  // each line needs its own Paragraph within the cell.
  const lines = String(text || "").split("\n");
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: lines.map(
      (line) => new Paragraph({ spacing: { line: 260 }, children: [new TextRun({ text: line, size: 18, color: DOCX_INK })] })
    ),
  });
}
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
  left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
  right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: DOCX_RULE },
};

function docxTable(headers, widths, rows) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => docxHeaderCell(h, widths[i])) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => docxCell(c, widths[i])) })),
    ],
  });
}

// A small side-by-side (columnar) table nested inside the Observation cell,
// one row per annexure line item, columns matching that annexure sheet's
// own headers — for when a flat "field: value" list is harder to scan than
// an actual grid.
function docxNestedTable(table, totalWidth) {
  const n = table.headers.length;
  if (!n) return null;
  const colWidth = Math.max(500, Math.floor(totalWidth / n));
  const widths = table.headers.map(() => colWidth);
  return new Table({
    width: { size: colWidth * n, type: WidthType.DXA },
    columnWidths: widths,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({ tableHeader: true, children: table.headers.map((h, i) => docxHeaderCell(h, widths[i])) }),
      ...table.rows.map((r) => new TableRow({ children: r.map((v, i) => docxCell(v, widths[i])) })),
    ],
  });
}

// Observation cell: the free-text wording first (still the primary, editable
// content), then — when the row's attached files carried recognizable
// annexure data — a "Source data" sub-table per file, laid out in real
// columns instead of a flat list.
function docxObservationCell(row, width) {
  const lines = String(row.observation || "").split("\n");
  const children = lines.map(
    (line) => new Paragraph({ spacing: { line: 260 }, children: [new TextRun({ text: line, size: 18, color: DOCX_INK })] })
  );
  (row.tables || []).forEach((t) => {
    if (!t || !t.headers || !t.headers.length || !t.rows.length) return;
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: "Source data:", italics: true, bold: true, size: 16, color: DOCX_INK })],
      })
    );
    const nested = docxNestedTable(t, width - 200);
    if (nested) children.push(nested);
  });
  if (!children.length) children.push(new Paragraph({ children: [new TextRun({ text: "", size: 18 })] }));
  return new TableCell({ width: { size: width, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children });
}

function buildReportDocx({ area, periodLabel, coverage, thematic }) {
  // Landscape, so the Observation column has room for a real nested table
  // (up to ~7 columns) instead of a cramped single narrow column.
  const coverageWidths = [700, 2600, 8600, 2438];
  const thematicWidths = [500, 2400, 2150, 2150, 2150];
  const coverageTable = new Table({
    width: { size: coverageWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: coverageWidths,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["Sl No", "Scope of Work", "Observation", "Management Reply"].map((h, i) => docxHeaderCell(h, coverageWidths[i])),
      }),
      ...coverage.map(
        (r) =>
          new TableRow({
            children: [
              docxCell(r.ref, coverageWidths[0]),
              docxCell(r.title, coverageWidths[1]),
              docxObservationCell(r, coverageWidths[2]),
              docxCell(r.reply, coverageWidths[3]),
            ],
          })
      ),
    ],
  });
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 600, bottom: 600, left: 600, right: 600 },
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
          coverageTable,
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
