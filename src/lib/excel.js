import { db, getProfile } from './db.js'
import { ageFrom, todayISO } from './format.js'

const PURPLE = 'FF2A0A3D'
const GOLD = 'FFD4A537'
const CREAM = 'FFFBF7EC'

function inRange(date, range) {
  if (!date) return false
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

function d(iso) {
  return iso ? new Date(iso + 'T00:00:00') : null
}

function addSheet(wb, name, columns, rows, profile, subtitle) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }], properties: { tabColor: { argb: GOLD } } })
  ws.columns = columns.map(c => ({ key: c.key, width: c.width || 16 }))
  ws.mergeCells(1, 1, 1, columns.length)
  const t = ws.getCell(1, 1)
  t.value = `${profile.clinicName || 'Gayathri Multi Speciality Clinic'} · ${name}`
  t.font = { name: 'Georgia', size: 15, bold: true, color: { argb: 'FFF3DC9B' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE } }
  t.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 30
  ws.mergeCells(2, 1, 2, columns.length)
  const s = ws.getCell(2, 1)
  s.value = subtitle
  s.font = { size: 9, italic: true, color: { argb: 'FF6B5A7A' } }
  s.alignment = { indent: 1 }
  const head = ws.getRow(3)
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, size: 10, color: { argb: PURPLE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: PURPLE } } }
  })
  head.height = 22
  rows.forEach((r, idx) => {
    const row = ws.addRow(r)
    row.alignment = { vertical: 'top', wrapText: true }
    if (idx % 2 === 1) row.eachCell({ includeEmpty: true }, c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } } })
  })
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    if (c.type === 'date') col.numFmt = 'dd-mmm-yyyy'
    if (c.type === 'money') col.numFmt = '"₹"#,##0'
  })
  if (rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } }
  return ws
}

export async function exportExcel(range) {
  const { default: ExcelJS } = await import('exceljs')
  const profile = await getProfile()
  const [patients, visits, appts, packages, expenses] = await Promise.all([db.patients.toArray(), db.visits.toArray(), db.appointments.toArray(), db.packages.toArray(), db.expenses.toArray()])
  const byId = Object.fromEntries(patients.map(p => [p.id, p]))
  const label = range.from || range.to ? `${range.from || 'start'} to ${range.to || 'today'}` : 'All records'
  const subtitle = `${label} · exported ${new Date().toLocaleString('en-IN')}`

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gayathri MediRecord'
  wb.created = new Date()

  addSheet(wb, 'Patients', [
    { key: 'code', header: 'Patient ID', width: 12 },
    { key: 'name', header: 'Name', width: 24 },
    { key: 'gender', header: 'Gender', width: 9 },
    { key: 'age', header: 'Age', width: 6 },
    { key: 'phone', header: 'Mobile', width: 14 },
    { key: 'altPhone', header: 'Alt. mobile', width: 14 },
    { key: 'email', header: 'Email', width: 22 },
    { key: 'city', header: 'City', width: 14 },
    { key: 'address', header: 'Address', width: 28 },
    { key: 'bloodGroup', header: 'Blood group', width: 8 },
    { key: 'department', header: 'Department', width: 14 },
    { key: 'allergies', header: 'Allergies', width: 20 },
    { key: 'history', header: 'Medical history', width: 28 },
    { key: 'registered', header: 'Registered', width: 13, type: 'date' },
    { key: 'lastVisit', header: 'Last visit', width: 13, type: 'date' }
  ], [...patients].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(p => ({
    ...p,
    age: ageFrom(p) === '' ? null : Number(ageFrom(p)),
    registered: p.createdAt ? new Date(p.createdAt) : null,
    lastVisit: d(p.lastVisit)
  })), profile, `${patients.length} patients · ${subtitle}`)

  const vRows = visits.filter(v => byId[v.patientId] && inRange(v.date, range)).sort((a, b) => a.date.localeCompare(b.date))
  addSheet(wb, 'Consultations', [
    { key: 'date', header: 'Date', width: 13, type: 'date' },
    { key: 'code', header: 'Patient ID', width: 12 },
    { key: 'name', header: 'Patient', width: 22 },
    { key: 'department', header: 'Department', width: 14 },
    { key: 'complaints', header: 'Complaints', width: 30 },
    { key: 'diagnosis', header: 'Diagnosis', width: 22 },
    { key: 'rx', header: 'Prescription', width: 34 },
    { key: 'acu', header: 'Acupuncture', width: 22 },
    { key: 'procedure', header: 'Procedure', width: 20 },
    { key: 'advice', header: 'Advice', width: 24 },
    { key: 'followUp', header: 'Follow-up', width: 13, type: 'date' }
  ], vRows.map(v => ({
    date: d(v.date),
    code: byId[v.patientId].code,
    name: byId[v.patientId].name,
    department: v.department,
    complaints: v.complaints,
    diagnosis: v.diagnosis,
    rx: (v.rx || []).map(r => [r.medicine, r.potency, r.dosage && `— ${r.dosage}`, r.duration && `× ${r.duration}`].filter(Boolean).join(' ')).join('\n'),
    acu: [v.points, v.sessionNo && `Session ${v.sessionNo}`].filter(Boolean).join(' · '),
    procedure: [v.procedure, v.area].filter(Boolean).join(' — '),
    advice: v.advice,
    followUp: d(v.followUp)
  })), profile, `${vRows.length} consultations · ${subtitle}`)

  const pay = visits.filter(v => byId[v.patientId] && Number(v.fee) > 0 && inRange(v.payMode === 'Pending' ? v.date : v.paidOn || v.date, range)).sort((a, b) => (a.paidOn || a.date).localeCompare(b.paidOn || b.date))
  const payWs = addSheet(wb, 'Payments', [
    { key: 'paidOn', header: 'Paid on', width: 13, type: 'date' },
    { key: 'date', header: 'Consultation', width: 13, type: 'date' },
    { key: 'receiptNo', header: 'Receipt no.', width: 15 },
    { key: 'code', header: 'Patient ID', width: 12 },
    { key: 'name', header: 'Patient', width: 22 },
    { key: 'department', header: 'Department', width: 14 },
    { key: 'mode', header: 'Mode', width: 10 },
    { key: 'amount', header: 'Amount', width: 12, type: 'money' }
  ], pay.map(v => ({
    paidOn: v.payMode === 'Pending' ? null : d(v.paidOn || v.date),
    date: d(v.date),
    receiptNo: v.receiptNo || '',
    code: byId[v.patientId].code,
    name: byId[v.patientId].name,
    department: v.department,
    mode: v.payMode,
    amount: Number(v.fee)
  })), profile, `${pay.length} payments · ${subtitle}`)
  if (pay.length) {
    const collected = pay.filter(v => v.payMode !== 'Pending').reduce((s, v) => s + Number(v.fee), 0)
    const pending = pay.filter(v => v.payMode === 'Pending').reduce((s, v) => s + Number(v.fee), 0)
    payWs.addRow({})
    const r1 = payWs.addRow({ mode: 'Collected', amount: collected })
    const r2 = payWs.addRow({ mode: 'Pending', amount: pending })
    ;[r1, r2].forEach(r => r.eachCell(c => { c.font = { bold: true, color: { argb: PURPLE } } }))
  }

  const aRows = appts.filter(a => byId[a.patientId] && inRange(a.date, range)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  addSheet(wb, 'Appointments', [
    { key: 'date', header: 'Date', width: 13, type: 'date' },
    { key: 'time', header: 'Time', width: 8 },
    { key: 'token', header: 'Token', width: 7 },
    { key: 'code', header: 'Patient ID', width: 12 },
    { key: 'name', header: 'Patient', width: 22 },
    { key: 'department', header: 'Department', width: 14 },
    { key: 'purpose', header: 'Purpose', width: 20 },
    { key: 'status', header: 'Status', width: 12 }
  ], aRows.map(a => ({ date: d(a.date), time: a.time || 'Any', token: a.token || null, code: byId[a.patientId].code, name: byId[a.patientId].name, department: a.department, purpose: a.purpose, status: a.status })), profile, `${aRows.length} appointments · ${subtitle}`)

  addSheet(wb, 'Packages', [
    { key: 'code', header: 'Patient ID', width: 12 },
    { key: 'pname', header: 'Patient', width: 22 },
    { key: 'name', header: 'Package', width: 28 },
    { key: 'department', header: 'Department', width: 14 },
    { key: 'startDate', header: 'Started', width: 13, type: 'date' },
    { key: 'totalSessions', header: 'Sessions', width: 9 },
    { key: 'used', header: 'Used', width: 7 },
    { key: 'left', header: 'Left', width: 7 },
    { key: 'price', header: 'Price', width: 11, type: 'money' },
    { key: 'amountPaid', header: 'Paid', width: 11, type: 'money' },
    { key: 'balance', header: 'Balance', width: 11, type: 'money' },
    { key: 'status', header: 'Status', width: 11 }
  ], packages.filter(p => byId[p.patientId]).map(p => {
    const used = visits.filter(v => v.packageId === p.id).length
    return {
      code: byId[p.patientId].code,
      pname: byId[p.patientId].name,
      name: p.name,
      department: p.department,
      startDate: d(p.startDate),
      totalSessions: Number(p.totalSessions),
      used,
      left: Math.max(0, Number(p.totalSessions) - used),
      price: Number(p.price) || 0,
      amountPaid: Number(p.amountPaid) || 0,
      balance: (Number(p.price) || 0) - (Number(p.amountPaid) || 0),
      status: p.status
    }
  }), profile, `${packages.length} packages · ${subtitle}`)

  const eRows = expenses.filter(e => inRange(e.date, range)).sort((a, b) => a.date.localeCompare(b.date))
  const expWs = addSheet(wb, 'Expenses', [
    { key: 'date', header: 'Date', width: 13, type: 'date' },
    { key: 'category', header: 'Category', width: 22 },
    { key: 'mode', header: 'Paid by', width: 10 },
    { key: 'note', header: 'Note', width: 34 },
    { key: 'amount', header: 'Amount', width: 12, type: 'money' }
  ], eRows.map(e => ({ date: d(e.date), category: e.category, mode: e.mode, note: e.note || '', amount: Number(e.amount) || 0 })), profile, `${eRows.length} expenses · ${subtitle}`)
  if (eRows.length) {
    expWs.addRow({})
    const tr = expWs.addRow({ note: 'Total', amount: eRows.reduce((s, e) => s + (Number(e.amount) || 0), 0) })
    tr.eachCell(c => { c.font = { bold: true, color: { argb: PURPLE } } })
  }

  const buf = await wb.xlsx.writeBuffer()
  return {
    blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename: `GMC-records-${todayISO()}.xlsx`,
    counts: { patients: patients.length, visits: vRows.length, payments: pay.length }
  }
}
