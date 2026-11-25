const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')
const readline = require('readline')
const zlib = require('zlib')
const createPg = require('./pgcore.cjs')

const PORT = Number(process.env.GMC_PORT) || 4747
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const DATA_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'GayathriMediRecord')
const CONFIG = path.join(DATA_DIR, 'postgres.json')
const LOG = path.join(DATA_DIR, 'server.log')
const URL_BASE = `http://localhost:${PORT}`

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

function log(line) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {}
}

const pg = createPg({
  read() {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
      return { host: raw.host, port: raw.port, user: raw.user, database: raw.database, password: Buffer.from(raw.password || '', 'base64').toString('utf8') }
    } catch {
      return null
    }
  },
  write(c) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(CONFIG, JSON.stringify({ host: c.host, port: c.port, user: c.user, database: c.database, password: Buffer.from(c.password, 'utf8').toString('base64') }))
  },
  remove() {
    try {
      fs.unlinkSync(CONFIG)
    } catch {}
  }
})

const b64 = bytes => Buffer.from(bytes).toString('base64')
const unb64 = text => new Uint8Array(Buffer.from(text || '', 'base64'))

const API = {
  status: () => pg.status(),
  connect: body => pg.connect(body.form || {}),
  forget: () => pg.forget(),
  push: body => pg.push((body.rows || []).map(r => ({ ...r, files: (r.files || []).map(f => ({ ...f, bytes: unb64(f.bytes) })) }))),
  pull: async body => {
    const r = await pg.pull(body.since, Number(body.offset) || 0, Number(body.limit) || 60)
    if (r.ok) r.data = r.data.map(row => ({ ...row, files: row.files.map(f => ({ ...f, bytes: b64(f.bytes) })) }))
    return r
  }
}

function allowedHost(req) {
  const host = String(req.headers.host || '').toLowerCase()
  if (host !== `localhost:${PORT}` && host !== `127.0.0.1:${PORT}`) return false
  const origin = req.headers.origin
  if (!origin) return true
  return origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', c => {
      size += c.length
      if (size > limit) {
        reject(new Error('Request too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function serveFile(req, res, pathname) {
  if (pathname === '/gmc-runtime.js') return send(res, 200, 'window.gmcServer = true\n', TYPES['.js'])
  let rel = decodeURIComponent(pathname)
  if (rel === '/' || !rel) rel = '/index.html'
  let file = path.normalize(path.join(DIST, rel))
  if (!file.startsWith(DIST)) return send(res, 403, 'Forbidden', TYPES['.txt'])
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  if (!fs.existsSync(file)) return send(res, 500, 'The app is not built yet. Run: npm run build', TYPES['.txt'])
  const ext = path.extname(file).toLowerCase()
  const cache = /\/assets\//.test(file.replace(/\\/g, '/')) ? 'public, max-age=31536000, immutable' : 'no-cache'
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' }
  const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && ['.txt', '.js', '.css', '.html', '.json', '.svg'].includes(ext)
  if (gzip) {
    headers['Content-Encoding'] = 'gzip'
    headers.Vary = 'Accept-Encoding'
    res.writeHead(200, headers)
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res)
    return
  }
  res.writeHead(200, headers)
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      if (!allowedHost(req)) return send(res, 403, { ok: false, error: 'Forbidden' })
      const { pathname } = new URL(req.url, URL_BASE)
      if (pathname.startsWith('/api/pg/')) {
        const name = pathname.slice('/api/pg/'.length)
        if (req.method !== 'POST' || !API[name]) return send(res, 404, { ok: false, error: 'Not found' })
        const raw = await readBody(req, 200 * 1024 * 1024)
        const body = raw ? JSON.parse(raw) : {}
        return send(res, 200, await API[name](body))
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', TYPES['.txt'])
      serveFile(req, res, pathname)
    } catch (err) {
      log('error ' + (err && err.stack ? err.stack : err))
      send(res, 500, { ok: false, error: (err && err.message) || 'Server error' })
    }
  })
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      log(`port ${PORT} already in use, another copy is running`)
      process.exit(0)
    }
    log('server error ' + err.message)
    process.exit(1)
  })
  server.listen(PORT, '127.0.0.1', () => {
    log(`listening on ${URL_BASE}`)
    if (process.stdout.isTTY) console.log(`Gayathri MediRecord is running at ${URL_BASE}`)
  })
  const stop = async () => {
    await pg.shutdown()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

function runningAlready() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/gmc-runtime.js', headers: { host: `localhost:${PORT}` }, timeout: 1500 }, res => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function startHidden() {
  const child = spawn(process.execPath, [__filename, '--serve'], { detached: true, stdio: 'ignore', windowsHide: true, cwd: ROOT })
  child.unref()
}

function powershell(command) {
  return new Promise(resolve => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit', windowsHide: true })
    p.on('exit', code => resolve(code === 0))
    p.on('error', () => resolve(false))
  })
}

function psQuote(text) {
  return "'" + String(text).replace(/'/g, "''") + "'"
}

async function installStartup() {
  const target = process.execPath
  const args = `"${__filename}"`
  const icon = path.join(ROOT, 'build', 'icon.ico')
  const cmd = [
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Gayathri MediRecord Server.lnk'))`,
    `$s.TargetPath = ${psQuote(target)}`,
    `$s.Arguments = ${psQuote(args)}`,
    `$s.WorkingDirectory = ${psQuote(ROOT)}`,
    `$s.WindowStyle = 7`,
    fs.existsSync(icon) ? `$s.IconLocation = ${psQuote(icon)}` : '',
    `$s.Description = 'Starts the Gayathri MediRecord local server'`,
    `$s.Save()`
  ].filter(Boolean).join('; ')
  return powershell(cmd)
}

async function removeStartup() {
  return powershell(`Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath('Startup')) 'Gayathri MediRecord Server.lnk')`)
}

function openEdge() {
  spawn('cmd.exe', ['/c', 'start', '', 'msedge', URL_BASE], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

async function waitUntilUp() {
  for (let i = 0; i < 20; i++) {
    if (await runningAlready()) return true
    await new Promise(r => setTimeout(r, 300))
  }
  return false
}

function ask(question, hidden, fallback) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    if (hidden) {
      rl._writeToOutput = text => {
        if (!muted || text === '\r\n' || text === '\n') rl.output.write(text)
        else rl.output.write('*'.repeat(text.length))
      }
    }
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim() === '' && fallback !== undefined ? fallback : answer)
    })
    muted = true
  })
}

async function setupPostgres(force) {
  const existing = await pg.status()
  if (existing.ok && existing.data && !force) {
    console.log(`PostgreSQL: saving to ${existing.data.database} on ${existing.data.host}:${existing.data.port}`)
    return true
  }
  if (!process.stdin.isTTY) return false
  console.log('')
  console.log('Connect PostgreSQL — press Enter to keep the value in [brackets]')
  const host = await ask('  Host [localhost]: ', false, 'localhost')
  const port = await ask('  Port [5432]: ', false, '5432')
  const user = await ask('  User [postgres]: ', false, 'postgres')
  const database = await ask('  Database [gmc_medirecord]: ', false, 'gmc_medirecord')
  for (let attempt = 1; attempt <= 3; attempt++) {
    const password = await ask('  Password: ', true)
    const r = await pg.connect({ host, port, user, password, database })
    if (r.ok) {
      console.log(`PostgreSQL connected: ${r.data.database} · ${r.data.patients} patients already saved`)
      await pg.shutdown()
      return true
    }
    console.log('  ' + r.error)
    if (r.offline) {
      console.log('  Start the PostgreSQL service (Windows: Services → postgresql → Start), then run: npm run clinic:postgres')
      return false
    }
  }
  console.log('Skipped. Run "npm run clinic:postgres" to try again.')
  return false
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--serve')) return startServer()
  if (args.includes('--foreground')) return startServer()
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('The app is not built yet. Run: npm run build')
    process.exit(1)
  }
  if (args.includes('--postgres')) {
    await setupPostgres(true)
    process.exit(0)
  }
  if (args.includes('--uninstall')) {
    await removeStartup()
    console.log('Removed the automatic start. The server stops after the next restart.')
    return
  }
  if (args.includes('--install')) await setupPostgres(false)
  if (!(await runningAlready())) startHidden()
  const up = await waitUntilUp()
  if (args.includes('--install') && process.platform === 'win32') {
    const ok = await installStartup()
    console.log(ok ? 'Done: the server now starts by itself when Windows starts.' : 'Could not add the automatic start. The server still runs now.')
  }
  if (!up) {
    console.log(`The server did not start. See ${LOG}`)
    process.exit(1)
  }
  console.log(`Gayathri MediRecord is running at ${URL_BASE}`)
  if (args.includes('--install') || args.includes('--open')) {
    if (process.platform === 'win32') openEdge()
  }
}

main()
