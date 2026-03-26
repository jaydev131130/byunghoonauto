# Project Instructions

## Desktop Build Defaults

- If the user says `빌드해줘`, always build all three desktop deliverables for the latest code:
  - macOS `.app`
  - macOS `.dmg`
  - Windows `.exe`
- For macOS builds, always rebuild the frontend first, then rebuild the packaged backend with:
  - `PYINSTALLER_CONFIG_DIR=/tmp/pyinstaller-config .venv-electron-build/bin/python -m PyInstaller --noconfirm --distpath dist-electron-resources --workpath build/pyinstaller packaging/electron-backend.spec`
- After the backend bundle is rebuilt, build the macOS desktop artifacts with:
  - `npm run desktop:pack:mac`
- For Windows `.exe`, use the existing GitHub Actions workflow in `.github/workflows/build-windows-electron.yml` when local Windows packaging is not available, then download the artifact into `artifacts/`.
- After `빌드해줘`, always report the exact output paths for `.app`, `.dmg`, and `.exe`.
- After `빌드해줘`, always try to launch the freshly built `.app` so the user can test it immediately.
- If GUI launch is blocked by the current environment, say that explicitly and provide the exact `.app` path plus the launch command:
  - `open /Users/jellies/My_Series/byunghoon/dist-electron/mac-arm64/EasyJo.app`

## Desktop Run Defaults

- If the user says `실행해줘`, always rebuild the latest macOS `.app` first, then launch that newly built `.app`.
- Do not reuse an older `.app` for `실행해줘` unless the user explicitly asks to skip the rebuild.
- For `실행해줘`, use the app at:
  - `dist-electron/mac-arm64/EasyJo.app`

## Artifact Handling

- Never commit generated build artifacts from `dist-electron/`, `dist-electron-resources/`, or `artifacts/` unless the user explicitly asks for that.
- Keep downloaded Windows installer artifacts under `artifacts/` with a date or purpose specific folder name so repeated builds do not overwrite each other.
