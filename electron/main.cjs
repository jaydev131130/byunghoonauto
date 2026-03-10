const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const HOST = "127.0.0.1";
const PORT = process.env.BYUNGHOON_PORT || "18400";
const BACKEND_URL = `http://${HOST}:${PORT}`;

let backendProcess = null;

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function bundledBackendExe() {
  return path.join(process.resourcesPath, "backend", "byunghoon-backend.exe");
}

function frontendDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "frontend", "dist");
  }
  return path.join(repoRoot(), "frontend", "dist");
}

function resolveBackendLaunch() {
  const env = {
    ...process.env,
    BYUNGHOON_HOST: HOST,
    BYUNGHOON_PORT: PORT,
    BYUNGHOON_APP_DATA_DIR: path.join(app.getPath("userData"), "data"),
    BYUNGHOON_FRONTEND_DIST: frontendDistPath(),
  };

  if (app.isPackaged) {
    const exePath = bundledBackendExe();
    if (!fs.existsSync(exePath)) {
      throw new Error(
        `Bundled backend executable is missing: ${exePath}\n` +
          "Build the Python backend separately and place it under dist-electron-resources/backend/."
      );
    }
    return { command: exePath, args: [], cwd: path.dirname(exePath), env };
  }

  const python =
    process.env.BYUNGHOON_PYTHON || (process.platform === "win32" ? "python" : "python3");
  return {
    command: python,
    args: [path.join(repoRoot(), "desktop_server.py")],
    cwd: repoRoot(),
    env,
  };
}

async function waitForBackend() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${BACKEND_URL}/docs`);
      if (response.ok) {
        return;
      }
    } catch (_) {
      // backend still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Backend did not become ready in time.");
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true
    }
  });

  await window.loadURL(BACKEND_URL);
  window.once("ready-to-show", () => window.show());
}

async function startBackend() {
  const launch = resolveBackendLaunch();
  backendProcess = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdio: app.isPackaged ? "ignore" : "inherit",
    windowsHide: true
  });

  backendProcess.once("exit", (code) => {
    backendProcess = null;
    if (code !== 0) {
      dialog.showErrorBox("Backend exited", `The backend process exited with code ${code}.`);
    }
  });

  await waitForBackend();
}

function stopBackend() {
  if (!backendProcess) {
    return;
  }
  backendProcess.kill();
  backendProcess = null;
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    await createMainWindow();
  } catch (error) {
    dialog.showErrorBox("Failed to start desktop app", String(error));
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("window-all-closed", () => {
  app.quit();
});
