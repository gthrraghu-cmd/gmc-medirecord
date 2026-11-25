import { fmtDate } from './format.js'
import { docT, docDept } from './i18n.jsx'

export function waNumber(phone = '') {
  const d = String(phone).replace(/\D/g, '')
  if (d.length === 10) return '91' + d
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1)
  return d
}

export function waLink(phone, text) {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}

function header(profile) {
  return `*${profile.clinicName || 'Gayathri Multi Speciality Clinic'}*`
}

function footer(profile) {
  return [profile.doctor, profile.clinicPhone && `📞 ${profile.clinicPhone}`].filter(Boolean).join('\n')
}

export function rxText(profile, patient, visit) {
  const L = k => docT(profile.docLang, k)
  const lines = [header(profile), `_${L('prescription')}_`, '', `${L('patient')}: ${patient.name} (${patient.code})`, `${L('date')}: ${fmtDate(visit.date)}`]
  if (visit.diagnosis) lines.push(`${L('diagnosis')}: ${visit.diagnosis}`)
  if (visit.rx?.length) {
    lines.push('', `*℞*`)
    visit.rx.forEach((r, i) => lines.push(`${i + 1}. ${[r.medicine, r.potency].filter(Boolean).join(' ')}${r.dosage ? ` — ${r.dosage}` : ''}${r.duration ? ` — ${r.duration}` : ''}`))
  }
  if (visit.points) lines.push('', `${L('points')}: ${visit.points}`)
  if (visit.sessionNo) lines.push(`${L('session')}: ${visit.sessionNo}`)
  if (visit.procedure) lines.push('', `${L('procedure')}: ${[visit.procedure, visit.area].filter(Boolean).join(' — ')}`)
  if (visit.advice) lines.push('', `${L('advice')}: ${visit.advice}`)
  if (visit.followUp) lines.push('', `${L('nextVisit')}: ${fmtDate(visit.followUp)}`)
  const f = footer(profile)
  if (f) lines.push('', f)
  return lines.join('\n')
}

export function receiptText(profile, patient, visit) {
  const L = k => docT(profile.docLang, k)
  const lines = [
    header(profile),
    '',
    `*${L('receipt')}* ${visit.receiptNo || ''}`.trim(),
    `${L('patient')}: ${patient.name} (${patient.code})`,
    `${L('date')}: ${fmtDate(visit.date)}`,
    `${L('service')}: ${docDept(profile.docLang, visit.department)} ${L('consultation')}${visit.procedure ? ` — ${visit.procedure}` : ''}`,
    `${L('amount')}: ₹${Number(visit.fee || 0).toLocaleString('en-IN')}`,
    `${L('status')}: ${visit.payMode === 'Pending' ? L('pending') : `${L('paid')} · ${visit.payMode}`}`
  ]
  const f = footer(profile)
  if (f) lines.push('', f)
  lines.push('', L('thanks'))
  return lines.join('\n')
}

export function apptText(profile, patient, appt, timeLabel) {
  const L = k => docT(profile.docLang, k)
  const lines = [
    header(profile),
    '',
    `${L('dear')} ${patient.name},`,
    `${L('apptConfirmed')}: *${fmtDate(appt.date)}*${appt.time ? ` · ${L('at')} *${timeLabel}*` : ''}.`,
    `${docDept(profile.docLang, appt.department)}${appt.purpose ? ` · ${appt.purpose}` : ''}`,
    `${L('id')}: ${patient.code}`
  ]
  if (profile.clinicAddress) lines.push('', `📍 ${profile.clinicAddress}`)
  const f = footer(profile)
  if (f) lines.push('', f)
  lines.push('', L('reschedule'))
  return lines.join('\n')
}

export function dueReminderText(profile, patient, visit) {
  const amount = Number(visit.fee || 0).toLocaleString('en-IN')
  return [
    header(profile),
    '',
    `${docT(profile.docLang, 'dear')} ${patient.name},`,
    docT(profile.docLang, 'reminder', { amount, date: fmtDate(visit.date) }),
    '',
    footer(profile)
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim()
}

function salutation(gender) {
  const g = String(gender || '').trim().toLowerCase()
  if (g === 'male') return ' sir'
  if (g === 'female') return ' mam'
  return ''
}

export function followUpText(profile, patient, date, overdue) {
  const clinic = profile.clinicName || 'Gayathri Multi Speciality Clinic'
  const name = String(patient.name || '').trim()
  const when = fmtDate(date)
  const body = overdue
    ? `This is a gentle reminder that your follow-up visit at ${clinic} was due on ${when}. Please reply here to book a convenient time.`
    : `This is a gentle reminder of your follow-up visit at ${clinic} on ${when}. Please reply here to confirm a convenient time.`
  return [`*${clinic}*`, '', `Hi ${name}${salutation(patient.gender)},`, body].join('\n')
}
