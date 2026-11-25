const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gmcDesktop', {
  platform: process.platform,
  pg: {
    status: () => ipcRenderer.invoke('pg:status'),
    connect: form => ipcRenderer.invoke('pg:connect', form),
    forget: () => ipcRenderer.invoke('pg:forget'),
    push: rows => ipcRenderer.invoke('pg:push', rows),
    pull: (since, offset, limit) => ipcRenderer.invoke('pg:pull', since, offset, limit)
  }
})
