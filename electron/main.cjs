const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 18400;
const STABLE_USER_DATA_DIRNAME = "EasyJoData";
const LEGACY_USER_DATA_DIRNAMES = [
  "EasyJo",
  "Jo Math",
  "Wrong Answer Builder",
  "조쌤오답노트",
];

let backendProcess = null;
let backendPort = Number(process.env.BYUNGHOON_PORT || DEFAULT_PORT);

function backendUrl() {
  return `http://${HOST}:${backendPort}`;
}

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function bundledBackendExecutableName() {
  return process.platform === "win32" ? "byunghoon-backend.exe" : "byunghoon-backend";
}

function bundledBackendCommand() {
  return path.join(process.resourcesPath, "backend", bundledBackendExecutableName());
}

function frontendDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "frontend", "dist");
  }
  return path.join(repoRoot(), "frontend", "dist");
}

function stableUserDataPath() {
  return path.join(app.getPath("appData"), STABLE_USER_DATA_DIRNAME);
}

function ensureStableAppDataDir() {
  const stableRoot = app.getPath("userData");
  const stableDataDir = path.join(stableRoot, "data");
  const stableDbPath = path.join(stableDataDir, "app.db");

  if (fs.existsSync(stableDbPath)) {
    return stableDataDir;
  }

  for (const legacyDirName of LEGACY_USER_DATA_DIRNAMES) {
    const legacyDataDir = path.join(app.getPath("appData"), legacyDirName, "data");
    const legacyDbPath = path.join(legacyDataDir, "app.db");
    if (!fs.existsSync(legacyDbPath)) {
      continue;
    }

    fs.mkdirSync(stableRoot, { recursive: true });
    fs.cpSync(legacyDataDir, stableDataDir, { recursive: true });
    return stableDataDir;
  }

  fs.mkdirSync(stableDataDir, { recursive: true });
  return stableDataDir;
}

function resolveBackendLaunch() {
  const env = {
    ...process.env,
    BYUNGHOON_HOST: HOST,
    BYUNGHOON_PORT: String(backendPort),
    BYUNGHOON_APP_DATA_DIR: ensureStableAppDataDir(),
    BYUNGHOON_FRONTEND_DIST: frontendDistPath(),
  };

  if (app.isPackaged) {
    const commandPath = bundledBackendCommand();
    if (!fs.existsSync(commandPath)) {
      throw new Error(
        `Bundled backend executable is missing: ${commandPath}\n` +
          "Build the Python backend separately and place it under dist-electron-resources/backend/."
      );
    }
    return { command: commandPath, args: [], cwd: path.dirname(commandPath), env };
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

async function findAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      reject(error);
    });
    server.listen(preferredPort, HOST, () => {
      const address = server.address();
      const selectedPort =
        address && typeof address === "object" ? address.port : preferredPort;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(selectedPort);
      });
    });
  });
}

async function waitForBackend() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${backendUrl()}/docs`);
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

  await window.loadURL(backendUrl());
  window.once("ready-to-show", () => window.show());
}

async function startBackend() {
  if (!process.env.BYUNGHOON_PORT) {
    backendPort = await findAvailablePort(0);
  }
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

app.setPath("userData", stableUserDataPath());

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
