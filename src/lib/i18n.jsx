import { createContext, useContext } from 'react'


const EN = {
  'nav.dashboard': 'Dashboard',
  'nav.patients': 'Patients',
  'nav.schedule': 'Schedule',
  'nav.followups': 'Follow-ups',
  'nav.billing': 'Billing',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'action.newPatient': 'New Patient',
  'action.lock': 'Lock',
  'action.search': 'Search',
  'shell.offline': 'Works fully offline · data stays on this device',

  'lock.welcome': 'Welcome back',
  'lock.welcomeSub': 'Enter your 4-digit PIN to open patient records',
  'lock.create': 'Set your clinic PIN',
  'lock.createSub': 'This PIN protects every record on this device',
  'lock.confirm': 'Confirm your PIN',
  'lock.confirmSub': 'Enter the same 4 digits once more',
  'lock.wrong': 'Incorrect PIN. Try again.',
  'lock.mismatch': 'PINs did not match. Start again.',
  'lock.footer': 'Private · Offline · PIN Protected',
  'lock.depts': 'Homoeopathy · Acupuncture · Cosmetology',

  'greet.morning': 'Good morning',
  'greet.afternoon': 'Good afternoon',
  'greet.evening': 'Good evening',
  'dash.todayN': '{n} consultation(s) recorded today.',
  'dash.todayNone': 'No consultations recorded yet today.',
  'dash.dueN': '{n} patient(s) due for follow-up.',
  'dash.dueNone': 'All follow-ups are on track.',
  'dash.openPatients': 'Open Patients',
  'dash.reports': 'Reports',
  'dash.patients': 'Patients',
  'dash.patientsHint': 'Registered in total',
  'dash.today': 'Today',
  'dash.todayHint': 'Consultations today',
  'dash.month': 'This month',
  'dash.monthHint': '{n} consultations',
  'dash.followups': 'Follow-ups',
  'dash.followupsHint': 'Due today or overdue',
  'dash.recent': 'Recent consultations',
  'dash.viewAll': 'View all',
  'dash.departments': 'Departments',
  'dash.departmentsHint': 'Consultations this month',
  'dash.backupTitle': 'Time for a secure backup',
  'dash.backupNow': 'Back up now',
  'dash.backupNever': 'No backup has been taken yet. Records live only on this device.',
  'dash.backupDays': 'Last backup was {n} day(s) ago. Records live only on this device.',
  'dash.tomorrow': 'Tomorrow',

  'patients.eyebrow': '{n} registered',
  'patients.title': 'Patients',
  'patients.register': 'Register Patient',
  'patients.search': 'Search name, mobile, GMC ID or city…',
  'patient.all': 'All patients',
  'patient.consultation': 'Consultation',
  'patient.edit': 'Edit',
  'patient.tab.visits': 'Consultations',
  'patient.tab.case': 'Case sheet',
  'patient.tab.packages': 'Packages',
  'patient.tab.photos': 'Photos',
  'patient.tab.docs': 'Documents',
  'patient.stat.visits': 'Consultations',
  'patient.stat.billed': 'Total billed',
  'patient.stat.next': 'Next follow-up',
  'patient.history': 'Consultation history',

  'schedule.eyebrow': 'Appointments & tokens',
  'schedule.title': 'Schedule',
  'schedule.walkin': 'Walk-in',
  'schedule.book': 'Book',
  'schedule.queue': "Today's queue",
  'schedule.calendar': 'Calendar',
  'schedule.now': 'Now serving',
  'schedule.callNext': 'Call next',
  'schedule.waiting': 'Waiting',
  'schedule.expected': 'Expected today',
  'schedule.completed': 'Completed',

  'follow.eyebrow': 'Patient recall',
  'follow.title': 'Follow-ups',
  'follow.overdue': 'Overdue',
  'follow.today': 'Today',
  'follow.week': 'Next 7 days',
  'follow.all': 'All upcoming',

  'billing.eyebrow': 'Collections & dues',
  'billing.title': 'Billing',
  'billing.closing': 'Daily closing',
  'billing.dues': 'Pending dues',
  'billing.print': 'Print closing',

  'reports.eyebrow': 'Insights',
  'reports.title': 'Reports',

  'settings.eyebrow': 'Preferences & safety',
  'settings.title': 'Settings',

  'dept.Homoeopathy': 'Homoeopathy',
  'dept.Acupuncture': 'Acupuncture',
  'dept.Cosmetology': 'Cosmetology',
  'dept.General': 'General'
}

const DICT = { en: EN }

export function translate(lang, key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) || EN[key] || key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
  return s
}

function fillVars(s, vars) {
  let out = s
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v)
  return out
}

export function translateText(lang, s, vars) {
  if (typeof s !== 'string') return s
  return fillVars(s, vars)
}

const t = (k, v) => translate('en', k, v)
const tx = (s, v) => translateText('en', s, v)
const VALUE = { lang: 'en', setLang: () => {}, t, tx }
const LangCtx = createContext(VALUE)

export function LangProvider({ children }) {
  return <LangCtx.Provider value={VALUE}>{children}</LangCtx.Provider>
}

export function useT() {
  return useContext(LangCtx)
}

const DOC_EN = {
  prescription: 'Prescription',
  patient: 'Patient',
  date: 'Date',
  id: 'ID',
  allergies: 'Allergies',
  complaints: 'Complaints',
  diagnosis: 'Diagnosis',
  findings: 'Findings',
  medicine: 'Medicine',
  dosage: 'Dosage',
  duration: 'Duration',
  points: 'Acupuncture points',
  session: 'Session',
  procedure: 'Procedure',
  products: 'Products',
  advice: 'Advice',
  nextVisit: 'Next visit',
  signature: 'Signature',
  doctor: 'Doctor',
  receipt: 'Payment Receipt',
  receiptNo: 'Receipt No.',
  paidOn: 'Paid on',
  description: 'Description',
  amount: 'Amount',
  total: 'Total',
  consultation: 'consultation',
  paid: 'Paid',
  pending: 'Payment pending',
  thanks: 'Thank you — wishing you good health',
  closing: 'Daily Closing',
  mode: 'Mode',
  dept: 'Dept',
  pendingToday: 'Pending today',
  consults: 'consultations',
  dueOf: 'due of',
  pills: 'pills',
  years: 'years',
  apptConfirmed: 'Your appointment is confirmed',
  at: 'at',
  dear: 'Dear',
  reschedule: 'Please reply here if you need to reschedule.',
  status: 'Status',
  service: 'Service',
  followUpSoon: 'This is a gentle reminder of your follow-up visit at {clinic} on {date}. Please reply here to confirm a convenient time.',
  followUpLate: 'Your follow-up visit at {clinic} was due on {date}. Please visit at your earliest convenience or reply here to book a time.',
  expense: 'Expense',
  cashCollected: 'Cash collected',
  cashSpent: 'cash spent',
  cashInHand: 'Cash in hand',
  reminder: '₹{amount} is pending for your consultation on {date}. Kindly settle it on your next visit or via UPI. Thank you.'
}

export function docT(docLang, key, vars) {
  let out = DOC_EN[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v)
  return out
}

export function docDept(docLang, dept) {
  return dept
}
