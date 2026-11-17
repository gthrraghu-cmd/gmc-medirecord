const fs = require('fs')
const path = require('path')
const { app, safeStorage } = require('electron')
const createPg = require('../server/pgcore.cjs')

function configFile() {
  return path.join(app.getPath('userData'), 'postgres.json')
}

const pg = createPg({
  read() {
    try {
      const raw = JSON.parse(fs.readFileSync(configFile(), 'utf8'))
      const buf = Buffer.from(raw.password || '', 'base64')
      const password = raw.enc ? safeStorage.decryptString(buf) : buf.toString('utf8')
      return { host: raw.host, port: raw.port, user: raw.user, database: raw.database, password }
    } catch {
      return null
    }
  },
  write(c) {
    const enc = safeStorage.isEncryptionAvailable()
    const password = enc ? safeStorage.encryptString(c.password).toString('base64') : Buffer.from(c.password, 'utf8').toString('base64')
    fs.writeFileSync(configFile(), JSON.stringify({ host: c.host, port: c.port, user: c.user, database: c.database, enc, password }))
  },
  remove() {
    try {
      fs.unlinkSync(configFile())
    } catch {}
  }
})

function register(ipcMain) {
  ipcMain.handle('pg:status', () => pg.status())
  ipcMain.handle('pg:connect', (e, form) => pg.connect(form))
  ipcMain.handle('pg:forget', () => pg.forget())
  ipcMain.handle('pg:push', (e, rows) => pg.push(rows))
  ipcMain.handle('pg:pull', (e, since, offset, limit) => pg.pull(since, offset, limit))
}

async function shutdown() {
  await pg.shutdown()
}

module.exports = { register, shutdown }
