import { useSyncExternalStore } from 'react'
import { db, SYNC_TABLES, SYNC_SETTINGS, onLocalChange, setTrackDeletes, tombKey, getSetting, setSetting } from './db.js'
import { deriveSyncKey, randomSalt, sealText, openText } from './crypto.js'
import { blobToDataURL, dataURLToBlob } from './image.js'
import { SyncError, normaliseUrl, signIn, refreshSession, upsertRows, fetchMeta, fetchPage } from './syncRemote.js'

const CFG = 'syncCfg'
const KEY = 'syncKey'
const CURSOR = 'syncCursor'
const LAST = 'syncLast'
const PAGE = 60
const BATCH_BYTES = 1500000
const BATCH_ROWS = 80
const OVERLAP_MS = 120000
const LOOP_MS = 30000
const CHECK = 'gmc-medirecord-ok'

let state = { enabled: false, mode: '', phase: 'off', lastSync: 0, message: '', pending: 0, email: '' }
const listeners = new Set()
function emit(patch) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}
function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useSyncStatus() {
  return useSyncExternalStore(subscribe, () => state)
}
export function syncState() {
  return state
}

let session = null
let cryptoKey = null
let running = null
let again = false
let loop = null
let debounce = null
let started = false

async function loadCfg() {
  return getSetting(CFG, null)
}

async function loadKey() {
  if (cryptoKey) return cryptoKey
  cryptoKey = await getSetting(KEY, null)
  return cryptoKey
}

function deviceName() {
  const ua = navigator.userAgent || ''
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad/i.test(ua)) return 'iPhone'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac/i.test(ua)) return 'Mac'
  return 'Device'
}

async function saveSession(cfg, s) {
  session = { access: s.access_token, exp: Date.now() + (Number(s.expires_in) || 3600) * 1000 - 60000 }
  const next = { ...cfg, refreshToken: s.refresh_token, userId: s.user?.id || cfg.userId }
  await setSetting(CFG, next)
  return next
}

async function token(cfg) {
  if (session && session.exp > Date.now()) return { cfg, access: session.access }
  const s = await refreshSession(cfg.url, cfg.anonKey, cfg.refreshToken)
  const next = await saveSession(cfg, s)
  return { cfg: next, access: session.access }
}

async function toWire(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === '_rs') continue
    out[k] = v instanceof Blob ? { __blob: await blobToDataURL(v) } : v
  }
  return out
}

function fromWire(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v && typeof v === 'object' && typeof v.__blob === 'string' ? dataURLToBlob(v.__blob) : v
  }
  return out
}

function remoteTx(fn) {
  return db.transaction('rw', [...SYNC_TABLES.map(n => db.table(n)), db.tombstones], async tx => {
    tx.__remote = true
    return fn(tx)
  })
}

function primKeyOf(name, row) {
  if (name === 'settings') return row.key
  if (name === 'cases') return row.patientId
  return row.id
}

async function dirtyItems() {
  const items = []
  for (const name of SYNC_TABLES) {
    let rows = await db.table(name).where('_rs').equals(0).toArray()
    if (name === 'settings') rows = rows.filter(r => SYNC_SETTINGS.includes(r.key))
    for (const r of rows) items.push({ kind: 'row', name, k: primKeyOf(name, r), mt: r._mt || Date.now(), row: r })
  }
  const tombs = await db.tombstones.where('_rs').equals(0).toArray()
  for (const t of tombs) items.push({ kind: 'tomb', name: t.table, k: t.key, mt: t._mt, tk: t.k, row: null })
  return items
}

async function countPending() {
  let n = 0
  for (const name of SYNC_TABLES) n += await db.table(name).where('_rs').equals(0).count()
  n += await db.tombstones.where('_rs').equals(0).count()
  return n
}

const cloudBackend = {
  needsKey: true,
  needsNetwork: true,
  async open(cfg) {
    const t = await token(cfg)
    return { cfg: t.cfg, access: t.access }
  },
  async push(ctx, items, key) {
    const { cfg, access } = ctx
    let batch = []
    let bytes = 0
    const flush = async () => {
      if (!batch.length) return
      await upsertRows(cfg.url, cfg.anonKey, access, batch)
      batch = []
      bytes = 0
    }
    for (const it of items) {
      const payload = it.row ? await sealText(key, JSON.stringify(await toWire(it.row))) : null
      batch.push({ owner: cfg.userId, table_name: it.name, record_key: JSON.stringify(it.k), updated_at: it.mt, deleted: !it.row, device: cfg.deviceId, payload })
      bytes += payload ? payload.length : 100
      if (bytes > BATCH_BYTES || batch.length >= BATCH_ROWS) await flush()
    }
    await flush()
  },
  async pullPage(ctx, since, offset, limit, key) {
    const rows = await fetchPage(ctx.cfg.url, ctx.cfg.anonKey, ctx.access, since, offset, limit)
    const out = []
    for (const r of rows) {
      let k
      try {
        k = JSON.parse(r.record_key)
      } catch {
        continue
      }
      let obj = null
      if (!r.deleted) {
        if (!r.payload) continue
        obj = fromWire(JSON.parse(await openText(key, r.payload)))
      }
      out.push({ name: r.table_name, k, mt: Number(r.updated_at), deleted: !!r.deleted, obj, ts: r.server_ts })
    }
    return { rows: out, count: rows.length }
  }
}

function pgApi() {
  const api = typeof window !== 'undefined' && window.gmcDesktop && window.gmcDesktop.pg
  if (!api) throw new SyncError('PostgreSQL works only in the installed desktop app.', 'server')
  return api
}

async function pgCall(promise) {
  const r = await promise
  if (!r || !r.ok) throw new SyncError((r && r.error) || 'PostgreSQL error', r && r.offline ? 'offline' : 'server')
  return r.data
}

async function toPg(row) {
  const data = {}
  const files = []
  for (const [k, v] of Object.entries(row)) {
    if (k === '_rs') continue
    if (v instanceof Blob) {
      files.push({ field: k, mime: v.type || 'application/octet-stream', bytes: new Uint8Array(await v.arrayBuffer()) })
      data[k] = { __file: v.type || 'file' }
    } else data[k] = v
  }
  return { data, files }
}

function fromPg(data, files) {
  const obj = { ...(data || {}) }
  for (const [k, v] of Object.entries(obj)) if (v && typeof v === 'object' && v.__file) delete obj[k]
  for (const f of files || []) obj[f.field] = new Blob([f.bytes], { type: f.mime })
  return obj
}

const pgBackend = {
  needsKey: false,
  needsNetwork: false,
  async open(cfg) {
    return { cfg }
  },
  async push(ctx, items) {
    const api = pgApi()
    let batch = []
    let bytes = 0
    const flush = async () => {
      if (!batch.length) return
      await pgCall(api.push(batch))
      batch = []
      bytes = 0
    }
    for (const it of items) {
      const rec = { t: it.name, id: String(it.k), mt: it.mt, deleted: !it.row, device: ctx.cfg.deviceId, data: null, files: [] }
      if (it.row) Object.assign(rec, await toPg(it.row))
      batch.push(rec)
      bytes += rec.files.reduce((n, f) => n + f.bytes.length, 0) + 500
      if (bytes > 8000000 || batch.length >= 200) await flush()
    }
    await flush()
  },
  async pullPage(ctx, since, offset, limit) {
    const rows = await pgCall(pgApi().pull(since, offset, limit))
    const out = rows.map(r => ({ name: r.t, k: r.t === 'settings' ? r.id : Number(r.id), mt: r.mt, deleted: r.deleted, obj: r.deleted ? null : fromPg(r.data, r.files), ts: r.ts }))
    return { rows: out, count: rows.length }
  }
}

function backendFor(cfg) {
  return cfg.mode === 'postgres' ? pgBackend : cloudBackend
}

async function push(backend, ctx, key) {
  const items = await dirtyItems()
  if (!items.length) return 0
  await backend.push(ctx, items, key)
  await remoteTx(async () => {
    for (const m of items) {
      if (m.kind === 'tomb') {
        const t = await db.tombstones.get(m.tk)
        if (t && t._mt === m.mt) await db.tombstones.update(m.tk, { _rs: 1 })
      } else {
        const cur = await db.table(m.name).get(m.k)
        if (cur && cur._mt === m.mt) await db.table(m.name).update(m.k, { _rs: 1 })
      }
    }
  })
  return items.length
}

async function applyPage(rows) {
  const ready = rows.filter(r => SYNC_TABLES.includes(r.name) && (r.name !== 'settings' || SYNC_SETTINGS.includes(r.k)) && (r.deleted || r.obj))
  if (!ready.length) return 0
  let changed = 0
  await remoteTx(async () => {
    for (const it of ready) {
      const table = db.table(it.name)
      const tk = tombKey(it.name, it.k)
      const [cur, tomb] = await Promise.all([table.get(it.k), db.tombstones.get(tk)])
      const localMt = Math.max(cur?._mt || 0, tomb?._mt || 0)
      if (it.mt <= localMt) continue
      if (it.deleted) {
        if (cur) await table.delete(it.k)
      } else {
        await table.put({ ...it.obj, _mt: it.mt, _rs: 1 })
      }
      if (tomb) await db.tombstones.delete(tk)
      changed++
    }
  })
  return changed
}

async function pull(backend, ctx, key) {
  const cursor = await getSetting(CURSOR, null)
  const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null
  let offset = 0
  let latest = cursor
  let changed = 0
  for (;;) {
    const { rows, count } = await backend.pullPage(ctx, since, offset, PAGE, key)
    if (!count) break
    changed += await applyPage(rows)
    for (const r of rows) if (r.ts && (!latest || Date.parse(r.ts) > Date.parse(latest))) latest = r.ts
    if (count < PAGE) break
    offset += count
  }
  if (latest && latest !== cursor) await setSetting(CURSOR, latest)
  return changed
}

async function cycle() {
  let cfg = await loadCfg()
  if (!cfg) {
    emit({ enabled: false, phase: 'off', mode: '' })
    return
  }
  const backend = backendFor(cfg)
  const key = backend.needsKey ? await loadKey() : null
  if (backend.needsKey && !key) {
    emit({ enabled: true, mode: cfg.mode || 'cloud', phase: 'error', message: 'Sync passphrase missing on this device. Connect again.' })
    return
  }
  if (backend.needsNetwork && typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit({ enabled: true, mode: cfg.mode || 'cloud', phase: 'offline', message: 'No internet connection.', pending: await countPending() })
    return
  }
  emit({ enabled: true, mode: cfg.mode || 'cloud', phase: 'syncing', email: cfg.email || '' })
  try {
    let pulled = 0
    let pushed = 0
    for (let attempt = 0; ; attempt++) {
      try {
        const ctx = await backend.open(cfg)
        if (ctx.cfg) cfg = ctx.cfg
        pulled += await pull(backend, ctx, key)
        pushed += await push(backend, ctx, key)
        break
      } catch (err) {
        if (attempt === 0 && err instanceof SyncError && err.kind === 'auth') {
          session = null
          continue
        }
        throw err
      }
    }
    const now = Date.now()
    await setSetting(LAST, now)
    emit({ phase: 'idle', lastSync: now, message: '', pending: await countPending(), pulled, pushed })
  } catch (err) {
    if (err instanceof SyncError && err.kind === 'offline') emit({ phase: 'offline', message: err.message, pending: await countPending() })
    else {
      if (err instanceof SyncError && err.kind === 'auth') session = null
      emit({ phase: 'error', message: err.message || 'Sync failed', pending: await countPending() })
    }
  }
}

export function syncNow() {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await cycle()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

function scheduleSoon() {
  if (!state.enabled) return
  clearTimeout(debounce)
  debounce = setTimeout(() => syncNow(), 3000)
  emit({ pending: state.pending + 1 })
}

const onOnline = () => syncNow()
const onVisible = () => {
  if (document.visibilityState === 'visible') syncNow()
}

export async function startSync() {
  const cfg = await loadCfg()
  setTrackDeletes(!!cfg)
  const last = await getSetting(LAST, 0)
  emit({ enabled: !!cfg, mode: cfg ? cfg.mode || 'cloud' : '', phase: cfg ? 'idle' : 'off', email: cfg?.email || '', lastSync: last })
  if (!cfg) return
  if (!started) {
    started = true
    onLocalChange(scheduleSoon)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    loop = setInterval(() => syncNow(), LOOP_MS)
  }
  syncNow()
}

export function stopSync() {
  if (!started) return
  started = false
  onLocalChange(null)
  window.removeEventListener('online', onOnline)
  document.removeEventListener('visibilitychange', onVisible)
  clearInterval(loop)
  clearTimeout(debounce)
}

async function connect({ url, anonKey, email, password }) {
  const base = normaliseUrl(url)
  const key = String(anonKey || '').trim()
  if (!base || !key) throw new Error('Enter the Project URL and anon key.')
  if (!email || !password) throw new Error('Enter the sync account email and password.')
  const s = await signIn(base, key, email.trim(), password)
  const existing = await loadCfg()
  const deviceId = existing?.deviceId || deviceName() + '-' + Math.random().toString(36).slice(2, 8)
  session = { access: s.access_token, exp: Date.now() + (Number(s.expires_in) || 3600) * 1000 - 60000 }
  const cfg = { url: base, anonKey: key, email: email.trim(), userId: s.user?.id, refreshToken: s.refresh_token, deviceId }
  const meta = await fetchMeta(base, key, s.access_token)
  return { cfg, access: s.access_token, meta }
}

async function finish(cfg, key) {
  cryptoKey = key
  await setSetting(KEY, key)
  await setSetting(CFG, cfg)
  setTrackDeletes(true)
  await startSync()
  await syncNow()
  return state
}

export async function setupFirstDevice(form) {
  if (!form.passphrase || form.passphrase.length < 8) throw new Error('Sync passphrase needs at least 8 characters.')
  const { cfg, access, meta } = await connect(form)
  if (meta) throw new Error('This account already holds clinic records. Choose “Join” instead.')
  const salt = randomSalt()
  const key = await deriveSyncKey(form.passphrase, salt)
  const check = await sealText(key, CHECK)
  await upsertRows(cfg.url, cfg.anonKey, access, [{ owner: cfg.userId, table_name: '_meta', record_key: 'check', updated_at: Date.now(), deleted: false, device: cfg.deviceId, payload: JSON.stringify({ v: 1, salt, check }) }])
  await markAllDirty()
  await setSetting(CURSOR, null)
  return finish({ ...cfg, salt }, key)
}

export async function joinDevice(form) {
  const { cfg, meta } = await connect(form)
  if (!meta) throw new Error('No clinic records on this account yet. Set up the first device instead.')
  const key = await deriveSyncKey(form.passphrase || '', meta.salt)
  let ok = false
  try {
    ok = (await openText(key, meta.check)) === CHECK
  } catch {
    ok = false
  }
  if (!ok) throw new Error('Wrong sync passphrase.')
  await remoteTx(async () => {
    for (const name of SYNC_TABLES) {
      if (name === 'settings') await db.settings.where('key').anyOf(SYNC_SETTINGS).delete()
      else await db.table(name).clear()
    }
    await db.tombstones.clear()
  })
  await setSetting(CURSOR, null)
  return finish({ ...cfg, salt: meta.salt }, key)
}

async function markAllDirty() {
  const now = Date.now()
  await remoteTx(async () => {
    for (const name of SYNC_TABLES) {
      const coll = name === 'settings' ? db.settings.where('key').anyOf(SYNC_SETTINGS) : db.table(name).toCollection()
      await coll.modify(r => {
        r._mt = r._mt || r.updatedAt || r.createdAt || now
        r._rs = 0
      })
    }
    await db.tombstones.clear()
  })
}

export function desktopPostgresAvailable() {
  return typeof window !== 'undefined' && !!(window.gmcDesktop && window.gmcDesktop.pg)
}

export async function connectPostgres(form) {
  const info = await pgCall(pgApi().connect(form))
  stopSync()
  await markAllDirty()
  await setSetting(CURSOR, null)
  const existing = await loadCfg()
  const cfg = { mode: 'postgres', host: info.host, port: info.port, user: info.user, database: info.database, deviceId: existing?.deviceId || deviceName() + '-' + Math.random().toString(36).slice(2, 8) }
  await setSetting(CFG, cfg)
  setTrackDeletes(true)
  await startSync()
  await syncNow()
  return { info, state }
}

export async function disconnectSync() {
  const cfg = await loadCfg()
  if (cfg?.mode === 'postgres' && desktopPostgresAvailable()) await window.gmcDesktop.pg.forget()
  stopSync()
  session = null
  cryptoKey = null
  setTrackDeletes(false)
  await db.settings.bulkDelete([CFG, KEY, CURSOR, LAST])
  await db.tombstones.clear()
  emit({ enabled: false, mode: '', phase: 'off', lastSync: 0, message: '', pending: 0, email: '' })
}

export async function resetPullCursor() {
  if (await loadCfg()) {
    await setSetting(CURSOR, null)
    syncNow()
  }
}

export function joinCode(cfg) {
  return btoa(JSON.stringify({ u: cfg.url, k: cfg.anonKey, e: cfg.email }))
}

export function readJoinCode(code) {
  try {
    const o = JSON.parse(atob(String(code).trim()))
    if (o.u && o.k) return { url: o.u, anonKey: o.k, email: o.e || '' }
  } catch {
    return null
  }
  return null
}

export async function currentCfg() {
  return loadCfg()
}

export const SYNC_SECRET = [CFG, KEY, CURSOR, LAST]
