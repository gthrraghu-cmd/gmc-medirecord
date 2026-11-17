import { db, getSetting, setSetting } from './db.js'
import { todayISO } from './format.js'
import { blobToDataURL, dataURLToBlob } from './image.js'
import { encryptText, decryptText } from './crypto.js'

const SECRET = ['pinHash', 'pinSalt', 'autoBackupDir', 'autoBackupPass', 'autoBackupOn', 'autoBackupLast', 'autoBackupFolder']
const FileSystemHandleLike = typeof FileSystemHandle !== 'undefined' ? FileSystemHandle : class {}
const APP = 'gayathri-medirecord'

async function buildPayload() {
  const [patients, visits, appointments, cases, packages, photos, documents, templates, expenses, settings] = await Promise.all([
    db.patients.toArray(),
    db.visits.toArray(),
    db.appointments.toArray(),
    db.cases.toArray(),
    db.packages.toArray(),
    db.photos.toArray(),
    db.documents.toArray(),
    db.templates.toArray(),
    db.expenses.toArray(),
    db.settings.toArray()
  ])
  const photoRows = []
  for (const p of photos) {
    photoRows.push({ ...p, blob: p.blob ? await blobToDataURL(p.blob) : null, thumb: p.thumb ? await blobToDataURL(p.thumb) : null })
  }
  const docRows = []
  for (const d of documents) {
    docRows.push({ ...d, blob: d.blob ? await blobToDataURL(d.blob) : null, thumb: d.thumb ? await blobToDataURL(d.thumb) : null })
  }
  return {
    app: APP,
    version: 5,
    exportedAt: new Date().toISOString(),
    patients,
    visits,
    appointments,
    cases,
    packages,
    photos: photoRows,
    documents: docRows,
    templates,
    expenses,
    settings: settings.filter(s => !SECRET.includes(s.key) && !(s.value instanceof FileSystemHandleLike))
  }
}

export async function createSecureBackup(password) {
  const payload = await buildPayload()
  const counts = { patients: payload.patients.length, visits: payload.visits.length, photos: payload.photos.length, documents: payload.documents.length }
  const box = await encryptText(JSON.stringify(payload), password)
  const file = { app: APP, secure: true, version: 5, exportedAt: payload.exportedAt, counts, ...box }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  return { blob, filename: `GMC-secure-backup-${todayISO()}.json`, counts }
}

export async function markBackedUp() {
  await setSetting('lastBackup', Date.now())
  await setSetting('backupSnoozeUntil', 0)
}

export function canShareFiles() {
  try {
    const f = new File(['x'], 'x.json', { type: 'application/json' })
    return !!(navigator.canShare && navigator.canShare({ files: [f] }))
  } catch {
    return false
  }
}

export async function deliverFile(blob, filename, mode = 'save') {
  if (mode === 'share' && canShareFiles()) {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}

export async function readBackupFile(file) {
  let data
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not a Gayathri MediRecord backup.')
  }
  if (data.app !== APP) throw new Error('This file is not a Gayathri MediRecord backup.')
  if (data.secure) return { encrypted: true, exportedAt: data.exportedAt, counts: data.counts || null, raw: data }
  if (!Array.isArray(data.patients) || !Array.isArray(data.visits)) throw new Error('This backup file is damaged.')
  return { encrypted: false, exportedAt: data.exportedAt, counts: { patients: data.patients.length, visits: data.visits.length, photos: (data.photos || []).length, documents: (data.documents || []).length }, raw: data }
}

export async function restoreBackup(parsed, password) {
  let data = parsed.raw
  if (parsed.encrypted) {
    const text = await decryptText(data, password)
    data = JSON.parse(text)
  }
  if (!Array.isArray(data.patients) || !Array.isArray(data.visits)) throw new Error('This backup file is damaged.')
  const list = k => (Array.isArray(data[k]) ? data[k] : [])
  const photos = list('photos').map(p => ({ ...p, blob: p.blob ? dataURLToBlob(p.blob) : null, thumb: p.thumb ? dataURLToBlob(p.thumb) : null }))
  const documents = list('documents').map(p => ({ ...p, blob: p.blob ? dataURLToBlob(p.blob) : null, thumb: p.thumb ? dataURLToBlob(p.thumb) : null }))
  await db.transaction('rw', [db.patients, db.visits, db.appointments, db.cases, db.packages, db.photos, db.documents, db.templates, db.expenses, db.settings], async () => {
    await Promise.all([db.patients.clear(), db.visits.clear(), db.appointments.clear(), db.cases.clear(), db.packages.clear(), db.photos.clear(), db.documents.clear(), db.templates.clear(), db.expenses.clear()])
    await db.patients.bulkAdd(data.patients)
    await db.visits.bulkAdd(data.visits)
    await db.appointments.bulkAdd(list('appointments'))
    await db.cases.bulkAdd(list('cases'))
    await db.packages.bulkAdd(list('packages'))
    await db.photos.bulkAdd(photos)
    await db.documents.bulkAdd(documents)
    await db.templates.bulkAdd(list('templates'))
    await db.expenses.bulkAdd(list('expenses'))
    for (const s of data.settings || []) {
      if (!SECRET.includes(s.key)) await db.settings.put(s)
    }
  })
  return { patients: data.patients.length, visits: data.visits.length }
}

export async function backupStatus() {
  const [last, every, snooze, patients] = await Promise.all([
    getSetting('lastBackup', 0),
    getSetting('backupEvery', 7),
    getSetting('backupSnoozeUntil', 0),
    db.patients.count()
  ])
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null
  const due = Number(every) > 0 && patients > 0 && (days === null || days >= Number(every)) && Date.now() > (snooze || 0)
  return { last, days, every: Number(every), due, patients }
}

export async function snoozeReminder() {
  await setSetting('backupSnoozeUntil', Date.now() + 86400000)
}
