const { app, BrowserWindow, protocol, net, shell, Menu, session, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const postgres = require('./postgres.cjs')

const SCHEME = 'app'
const HOST = 'medirecord'
const DIST = path.join(__dirname, '..', 'dist')

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }
])

const primary = app.requestSingleInstanceLock()
if (!primary) app.quit()

let win = null

function serve(request) {
  const url = new URL(request.url)
  let rel = decodeURIComponent(url.pathname)
  if (!rel || rel === '/') rel = '/index.html'
  let file = path.normalize(path.join(DIST, rel))
  if (!file.startsWith(DIST)) return new Response('Not allowed', { status: 403 })
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  return net.fetch(pathToFileURL(file).toString())
}

function isInternal(target) {
  try {
    const u = new URL(target)
    return u.protocol === SCHEME + ':' && u.host === HOST
  } catch {
    return false
  }
}

function openOutside(target) {
  if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(target)) shell.openExternal(target)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 400,
    minHeight: 600,
    show: false,
    backgroundColor: '#12031f',
    title: 'Gayathri MediRecord',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    }
  })
  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: 'allow' }
    openOutside(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isInternal(url)) return
    event.preventDefault()
    openOutside(url)
  })
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control) return
    const wc = win.webContents
    if (input.key === '=' || input.key === '+') {
      wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 4))
      event.preventDefault()
    } else if (input.key === '-') {
      wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3))
      event.preventDefault()
    } else if (input.key === '0') {
      wc.setZoomLevel(0)
      event.preventDefault()
    }
  })
  win.loadURL(`${SCHEME}://${HOST}/index.html`)
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  if (!primary) return
  Menu.setApplicationMenu(null)
  protocol.handle(SCHEME, serve)
  postgres.register(ipcMain)
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(isInternal(details.requestingUrl || wc.getURL()))
  })
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => isInternal(origin + '/') || isInternal(origin))
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  postgres.shutdown()
})
