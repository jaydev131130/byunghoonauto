# Electron Packaging Spike

This worktree adds a thin Electron shell on top of the existing FastAPI + built React app.

## Goal

- Keep the current Python backend and SQLite/data flow intact.
- Launch the backend automatically from Electron.
- Show the existing app inside a desktop window instead of a browser tab.
- Keep the Windows packaging path plausible without fully solving every production concern yet.

## What changed

- `electron/main.cjs`
  - Starts the backend process.
  - Waits for FastAPI to become ready.
  - Opens a desktop window pointed at the local backend URL.
- `electron/preload.cjs`
  - Minimal preload bridge for future desktop-only features.
- `desktop_server.py`
  - Production-like backend entrypoint for Electron.
  - No browser auto-open, no reload mode.
- `backend/config.py`
  - Supports `BYUNGHOON_APP_DATA_DIR` so Electron can store SQLite/images/PDFs under the user's app-data directory.
- `main.py`
  - Supports `BYUNGHOON_FRONTEND_DIST` so packaged frontend assets can live outside the repo root.
- `package.json`
  - Adds Electron/electron-builder scripts and config for the spike.

## Development flow

1. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Install Electron dependencies at the repo root:

   ```bash
   npm install
   ```

3. Build the frontend:

   ```bash
   npm run desktop:frontend:build
   ```

4. Launch the Electron shell:

   ```bash
   npm run desktop:dev
   ```

## Windows packaging direction

This spike assumes a two-step desktop build:

1. Package the Python backend separately as `byunghoon-backend.exe`.
2. Place that executable under:

   ```text
   dist-electron-resources/backend/byunghoon-backend.exe
   ```

3. Run:

   ```bash
   npm run desktop:pack:win
   ```

During packaging, Electron Builder copies that backend executable into the app resources.

## Build from macOS via GitHub Actions

If you only develop on macOS, use the Windows GitHub Actions runner to build the Windows desktop app.

Workflow:

- `.github/workflows/build-windows-electron.yml`

What it does:

1. Builds `frontend/dist`
2. Builds the Python backend as a Windows executable with PyInstaller
3. Places that backend bundle under `dist-electron-resources/backend`
4. Runs `electron-builder --win nsis`
5. Uploads the generated Windows installer artifacts

How to use it:

1. Push your branch to GitHub
2. Open the Actions tab
3. Run `Build Windows Electron App`
4. Download the installer artifact from the workflow run

## Known gaps

- The Python backend executable is not built by this spike.
- No auto-update flow.
- No code signing.
- No crash/log collection yet.
- No installer polish beyond the default NSIS target.
