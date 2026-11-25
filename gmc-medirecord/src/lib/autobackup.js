import { getSetting, setSetting } from './db.js'
import { createSecureBackup, markBackedUp } from './backup.js'
import { todayISO } from './format.js'

const HANDLE_DB = 'gmc-handles'
let cachedDir = null

function handleStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('h')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction('h', mode)
        const out = fn(tx.objectStore('h'))
        tx.oncomplete = () => resolve(out?.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      } catch (err) {
        reject(err)
      }
    }
  })
}

async function getDir() {
  if (cachedDir) return cachedDir
  try {
    cachedDir = (await handleStore('readonly', s => s.get('backupDir'))) || null
  } catch {
    cachedDir = null
  }
  return cachedDir
}

async function setDir(dir) {
  cachedDir = dir
  try {
    if (dir) await handleStore('readwrite', s => s.put(dir, 'backupDir'))
    else await handleStore('readwrite', s => s.delete('backupDir'))
  } catch {}
}

const KEEP = 14
const PREFIX = 'GMC-auto-'
const DAY = 20 * 60 * 60 * 1000

export function autoBackupSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function autoBackupStatus() {
  const [on, last, folder] = await Promise.all([getSetting('autoBackupOn', false), getSetting('autoBackupLast', 0), getSetting('autoBackupFolder', '')])
  const dir = on ? await getDir() : null
  let permission = 'unknown'
  if (dir?.queryPermission) {
    try {
      permission = await dir.queryPermission({ mode: 'readwrite' })
    } catch {
      permission = 'denied'
    }
  }
  return { supported: autoBackupSupported(), on: !!on && !!dir, folder: dir?.name || folder, last, permission }
}

export async function chooseBackupFolder(password) {
  const dir = await window.showDirectoryPicker({ id: 'gmc-backups', mode: 'readwrite', startIn: 'documents' })
  await setDir(dir)
  await setSetting('autoBackupFolder', dir.name)
  await setSetting('autoBackupPass', password)
  await setSetting('autoBackupOn', true)
  return dir.name
}

export async function turnOffAutoBackup() {
  await setSetting('autoBackupOn', false)
  await setDir(null)
  await setSetting('autoBackupPass', null)
}

async function prune(dir) {
  const names = []
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file' && name.startsWith(PREFIX) && name.endsWith('.json')) names.push(name)
  }
  names.sort().reverse()
  for (const name of names.slice(KEEP)) {
    try {
      await dir.removeEntry(name)
    } catch {}
  }
}

export async function runAutoBackup({ force = false, interactive = false } = {}) {
  if (!autoBackupSupported()) return { skipped: 'unsupported' }
  const [on, pass, last] = await Promise.all([getSetting('autoBackupOn', false), getSetting('autoBackupPass', null), getSetting('autoBackupLast', 0)])
  if (!on || !pass) return { skipped: 'off' }
  const dir = await getDir()
  if (!dir) return { skipped: 'off' }
  if (!force && Date.now() - (last || 0) < DAY) return { skipped: 'recent' }
  let perm = await dir.queryPermission({ mode: 'readwrite' })
  if (perm !== 'granted' && interactive) perm = await dir.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return { needsPermission: true, folder: dir.name }
  const { blob, counts } = await createSecureBackup(pass)
  const name = `${PREFIX}${todayISO()}.json`
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(blob)
  await w.close()
  await prune(dir)
  await setSetting('autoBackupLast', Date.now())
  await markBackedUp()
  return { done: true, name, folder: dir.name, counts }
}
