const { app, BrowserWindow } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawnSync, spawn } = require("child_process");

const PRODUCT_NAME = "MCL Audit Report Builder";

function installDir() {
  return path.join(app.getPath("localAppData"), "Programs", "MCLAuditReportBuilder");
}

function createShortcuts(targetExe) {
  const desktopLnk = path.join(os.homedir(), "Desktop", PRODUCT_NAME + ".lnk");
  const startMenuDir = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "Microsoft", "Windows", "Start Menu", "Programs"
  );
  const startMenuLnk = path.join(startMenuDir, PRODUCT_NAME + ".lnk");
  const script = `
$ws = New-Object -ComObject WScript.Shell
foreach ($p in @("${desktopLnk.replace(/\\/g, "\\\\")}", "${startMenuLnk.replace(/\\/g, "\\\\")}")) {
  $s = $ws.CreateShortcut($p)
  $s.TargetPath = "${targetExe.replace(/\\/g, "\\\\")}"
  $s.WorkingDirectory = "${path.dirname(targetExe).replace(/\\/g, "\\\\")}"
  $s.Save()
}
`;
  spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
}

// On first run of the portable exe, copy the app into a stable per-user
// install location and create Start Menu / Desktop shortcuts, so it behaves
// like a normally installed application instead of a temp-extracted binary.
function ensureInstalled() {
  if (process.platform !== "win32" || !app.isPackaged) return false;

  const currentDir = path.dirname(process.execPath);
  const target = installDir();

  if (currentDir.toLowerCase() === target.toLowerCase()) return false;

  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(currentDir, target, { recursive: true, force: true });

  const exeName = path.basename(process.execPath);
  const targetExe = path.join(target, exeName);
  createShortcuts(targetExe);

  spawn(targetExe, [], { detached: true, stdio: "ignore" }).unref();
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: PRODUCT_NAME,
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
  if (ensureInstalled()) {
    app.quit();
    return;
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
