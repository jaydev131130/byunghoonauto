const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopRuntime", {
  shell: "electron-spike"
});
