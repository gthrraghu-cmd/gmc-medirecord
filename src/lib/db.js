import Dexie from 'dexie'
import { todayISO } from './format.js'

export const db = new Dexie('gayathri_medirecord')

db.version(1).stores({
  patients: '++id, &code, name, phone, department, createdAt, updatedAt',
  visits: '++id, patientId, date, department, followUp, createdAt',
  settings: 'key'
})

db.version(2).stores({
  patients: '++id, &code, name, phone, department, createdAt, updatedAt',
  visits: '++id, patientId, date, department, followUp, createdAt, payMode, paidOn',
  settings: 'key'
})

db.version(3).stores({
  patients: '++id, &code, name, phone, department, createdAt, updatedAt',
  visits: '++id, patientId, date, department, followUp, createdAt, payMode, paidOn',
  appointments: '++id, date, patientId, status, token, [date+patientId], createdAt',
  settings: 'key'
})

db.version(4).stores({
  patients: '++id, &code, name, phone, department, createdAt, updatedAt',
  visits: '++id, patientId, date, department, followUp, createdAt, payMode, paidOn, packageId',
  appointments: '++id, date, patientId, status, token, [date+patientId], createdAt',
  cases: 'patientId, updatedAt',
  packages: '++id, patientId, status, createdAt',
  photos: '++id, patientId, area, date, createdAt',
  settings: 'key'
})

db.version(5).stores({
  patients: '++id, &code, name, phone, department, createdAt, updatedAt',
  visits: '++id, patientId, date, department, followUp, createdAt, payMode, paidOn, packageId',
  appointments: '++id, date, patientId, status, token, [date+patientId], createdAt',
  cases: 'patientId, updatedAt',
  packages: '++id, patientId, status, createdAt',
  photos: '++id, patientId, area, date, createdAt',
  documents: '++id, patientId, category, date, createdAt',
  settings: 'key'
})

db.version(6).stores({
  patients: '++id, &code, name, phone, department, createdAt, updatedAt',
  visits: '++id, patientId, date, department, followUp, createdAt, payMode, paidOn, packageId',
  appointments: '++id, date, patientId, status, token, [date+patientId], createdAt',
  cases: 'patientId, updatedAt',
  packages: '++id, patientId, status, createdAt',
  photos: '++id, patientId, area, date, createdAt',
  documents: '++id, patientId, category, date, createdAt',
  templates: '++id, name, department, uses, createdAt',
  expenses: '++id, date, category, createdAt',
  settings: 'key'
})

export const EXPENSE_CATEGORIES = ['Rent', 'Salaries', 'Medicines & supplies', 'Electricity & utilities', 'Equipment', 'Maintenance', 'Marketing', 'Other']
export const EXPENSE_MODES = ['Cash', 'UPI', 'Card', 'Bank']

export const DEPARTMENTS = [
  { key: 'Homoeopathy', tone: 'text-violet-200 border-violet-300/30 bg-violet-400/10' },
  { key: 'Acupuncture', tone: 'text-amber-200 border-amber-300/30 bg-amber-400/10' },
  { key: 'Cosmetology', tone: 'text-pink-200 border-pink-300/30 bg-pink-400/10' },
  { key: 'General', tone: 'text-sky-200 border-sky-300/30 bg-sky-400/10' }
]

export const PAY_MODES = ['Cash', 'UPI', 'Card']

export const APPT_STATUS = {
  booked: { label: 'Booked', tone: 'border-sky-300/30 text-sky-200' },
  waiting: { label: 'Waiting', tone: 'border-gold-400/40 text-gold-300' },
  in: { label: 'With doctor', tone: 'border-emerald-300/35 text-emerald-200' },
  done: { label: 'Done', tone: 'border-gold-500/15 text-gold-200/50' },
  noshow: { label: 'No-show', tone: 'border-rose-300/30 text-rose-200' },
  cancelled: { label: 'Cancelled', tone: 'border-gold-500/15 text-gold-200/40' }
}

export function deptTone(key) {
  return (DEPARTMENTS.find(d => d.key === key) || DEPARTMENTS[3]).tone
}

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}

export async function getProfile() {
  return {
    clinicName: 'Gayathri Multi Speciality Clinic',
    doctor: '',
    qualification: '',
    regNo: '',
    clinicPhone: '',
    clinicAddress: '',
    autoLock: '10',
    ...((await getSetting('profile')) || {}),
    docLang: 'en'
  }
}

export async function nextPatientCode() {
  const counter = (await getSetting('patientCounter', 0)) + 1
  await setSetting('patientCounter', counter)
  return 'GMC-' + String(counter).padStart(4, '0')
}

async function nextReceiptNo() {
  const counter = (await getSetting('receiptCounter', 0)) + 1
  await setSetting('receiptCounter', counter)
  return 'GMC/R/' + String(counter).padStart(5, '0')
}

function hasFee(v) {
  return v.fee !== '' && v.fee !== undefined && v.fee !== null && Number(v.fee) > 0
}

export async function savePatient(data) {
  const now = Date.now()
  if (data.id) {
    await db.patients.update(data.id, { ...data, updatedAt: now })
    return data.id
  }
  return db.transaction('rw', db.patients, db.settings, async () => {
    const code = await nextPatientCode()
    return db.patients.add({ ...data, code, createdAt: now, updatedAt: now })
  })
}

export async function deletePatient(id) {
  await db.transaction('rw', [db.patients, db.visits, db.appointments, db.cases, db.packages, db.photos, db.documents], async () => {
    await db.documents.where('patientId').equals(id).delete()
    await db.visits.where('patientId').equals(id).delete()
    await db.appointments.where('patientId').equals(id).delete()
    await db.packages.where('patientId').equals(id).delete()
    await db.photos.where('patientId').equals(id).delete()
    await db.cases.delete(id)
    await db.patients.delete(id)
  })
}

export async function saveVisit(data) {
  const now = Date.now()
  return db.transaction('rw', [db.visits, db.patients, db.settings, db.appointments, db.packages], async () => {
    const row = { ...data, updatedAt: now }
    if (!row.packageId) row.packageId = 0
    if (row.payMode === 'Pending') row.paidOn = ''
    else if (!row.paidOn) row.paidOn = row.date
    if (hasFee(row) && !row.receiptNo) row.receiptNo = await nextReceiptNo()
    if (row.id) {
      const before = await db.visits.get(row.id)
      await db.visits.update(row.id, row)
      await db.patients.update(row.patientId, { updatedAt: now })
      await syncPackage(row.packageId)
      if (before?.packageId && before.packageId !== row.packageId) await syncPackage(before.packageId)
      return row.id
    }
    const id = await db.visits.add({ ...row, createdAt: now })
    await syncPackage(row.packageId)
    await db.patients.update(row.patientId, { updatedAt: now, lastVisit: row.date })
    const open = await db.appointments.where('[date+patientId]').equals([row.date, row.patientId]).filter(a => ['booked', 'waiting', 'in'].includes(a.status)).toArray()
    for (const a of open) await db.appointments.update(a.id, { status: 'done', doneAt: now, visitId: id })
    return id
  })
}

export async function deleteVisit(id) {
  await db.transaction('rw', db.visits, db.packages, async () => {
    const v = await db.visits.get(id)
    await db.visits.delete(id)
    if (v?.packageId) await syncPackage(v.packageId)
  })
}

async function syncPackage(packageId) {
  if (!packageId) return
  const pkg = await db.packages.get(packageId)
  if (!pkg) return
  const used = await db.visits.where('packageId').equals(packageId).count()
  const status = pkg.status === 'closed' ? 'closed' : used >= Number(pkg.totalSessions || 0) ? 'completed' : 'active'
  await db.packages.update(packageId, { used, status, updatedAt: Date.now() })
}

export async function getCase(patientId) {
  return (await db.cases.get(patientId)) || null
}

export async function saveCase(patientId, data) {
  await db.cases.put({ ...data, patientId, updatedAt: Date.now() })
}

export async function savePackage(data) {
  const now = Date.now()
  if (data.id) {
    await db.packages.update(data.id, { ...data, updatedAt: now })
    await db.transaction('rw', db.visits, db.packages, () => syncPackage(data.id))
    return data.id
  }
  return db.packages.add({ status: 'active', used: 0, ...data, createdAt: now, updatedAt: now })
}

export async function deletePackage(id) {
  await db.transaction('rw', db.visits, db.packages, async () => {
    await db.visits.where('packageId').equals(id).modify({ packageId: 0 })
    await db.packages.delete(id)
  })
}

export async function addPhoto(data) {
  return db.photos.add({ ...data, createdAt: Date.now() })
}

export async function updatePhoto(id, changes) {
  await db.photos.update(id, changes)
}

export async function deletePhoto(id) {
  await db.photos.delete(id)
}

export async function markPaid(id, mode, paidOn) {
  await db.visits.update(id, { payMode: mode, paidOn, collectedLater: true, updatedAt: Date.now() })
}

export async function ensureReceiptNo(id) {
  return db.transaction('rw', db.visits, db.settings, async () => {
    const v = await db.visits.get(id)
    if (!v) return null
    if (v.receiptNo) return v.receiptNo
    const receiptNo = await nextReceiptNo()
    await db.visits.update(id, { receiptNo })
    return receiptNo
  })
}

async function nextToken(date) {
  const list = await db.appointments.where('date').equals(date).toArray()
  return list.reduce((m, a) => Math.max(m, a.token || 0), 0) + 1
}

export async function saveAppointment(data) {
  const now = Date.now()
  if (data.id) {
    await db.appointments.update(data.id, { ...data, updatedAt: now })
    return data.id
  }
  return db.appointments.add({ status: 'booked', time: '', purpose: '', ...data, createdAt: now, updatedAt: now })
}

export async function findOpenAppointment(patientId, date) {
  return db.appointments.where('[date+patientId]').equals([date, patientId]).filter(a => ['booked', 'waiting', 'in'].includes(a.status)).first()
}

export async function bookFollowUp(visit) {
  const existing = await findOpenAppointment(visit.patientId, visit.followUp)
  if (existing) return { id: existing.id, existed: true }
  const id = await saveAppointment({ patientId: visit.patientId, date: visit.followUp, department: visit.department, purpose: 'Follow-up', fromVisit: visit.id })
  return { id, existed: false }
}

export async function checkIn(id) {
  return db.transaction('rw', db.appointments, async () => {
    const a = await db.appointments.get(id)
    if (!a) return null
    const token = a.token || (await nextToken(a.date))
    await db.appointments.update(id, { status: 'waiting', token, checkedInAt: Date.now(), updatedAt: Date.now() })
    return token
  })
}

export async function walkIn(patientId, department) {
  const date = todayISO()
  return db.transaction('rw', db.appointments, async () => {
    const open = await db.appointments.where('[date+patientId]').equals([date, patientId]).filter(a => ['booked', 'waiting', 'in'].includes(a.status)).first()
    if (open) {
      const token = open.token || (await nextToken(date))
      await db.appointments.update(open.id, { status: open.status === 'in' ? 'in' : 'waiting', token, checkedInAt: open.checkedInAt || Date.now(), updatedAt: Date.now() })
      return token
    }
    const token = await nextToken(date)
    const d = new Date()
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    await db.appointments.add({ patientId, date, time, department, purpose: 'Walk-in', status: 'waiting', token, walkIn: true, checkedInAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() })
    return token
  })
}

export async function setApptStatus(id, status) {
  const stamp = { in: 'calledAt', done: 'doneAt' }[status]
  await db.appointments.update(id, { status, updatedAt: Date.now(), ...(stamp ? { [stamp]: Date.now() } : {}) })
}

export async function deleteAppointment(id) {
  await db.appointments.delete(id)
}

export async function addDocument(data) {
  return db.documents.add({ ...data, createdAt: Date.now() })
}

export async function deleteDocument(id) {
  await db.documents.delete(id)
}

export async function markReminded(visitId) {
  await db.visits.update(visitId, { remindedAt: Date.now() })
}

export async function saveTemplate(data) {
  const now = Date.now()
  if (data.id) {
    await db.templates.update(data.id, { ...data, updatedAt: now })
    return data.id
  }
  return db.templates.add({ uses: 0, ...data, createdAt: now, updatedAt: now })
}

export async function deleteTemplate(id) {
  await db.templates.delete(id)
}

export async function bumpTemplate(id) {
  const t = await db.templates.get(id)
  if (t) await db.templates.update(id, { uses: (t.uses || 0) + 1, lastUsed: Date.now() })
}

export async function saveExpense(data) {
  const now = Date.now()
  if (data.id) {
    await db.expenses.update(data.id, { ...data, updatedAt: now })
    return data.id
  }
  return db.expenses.add({ ...data, createdAt: now, updatedAt: now })
}

export async function deleteExpense(id) {
  await db.expenses.delete(id)
}
