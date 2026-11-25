import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Users, Stethoscope, IndianRupee, CalendarClock, ChevronRight, Sparkles, ShieldAlert, Lock, BarChart3 } from 'lucide-react'
import { db, DEPARTMENTS } from '../lib/db.js'
import { fmtDate, fmtMoney, todayISO } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'
import { Avatar, DeptChip, Empty } from '../components/ui.jsx'
import { BackupDialog } from '../components/DataDialogs.jsx'
import { backupStatus, snoozeReminder } from '../lib/backup.js'

const fade = i => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.06, duration: 0.5 } })

function Stat({ i, icon: Icon, label, value, hint }) {
  return (
    <motion.div {...fade(i)} className="glass group relative overflow-hidden p-5">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold-500/10 blur-2xl transition group-hover:bg-gold-500/20" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold-400/80">{label}</span>
        <Icon size={18} className="text-gold-400" />
      </div>
      <p className="mt-3 font-display text-4xl font-bold gold-text">{value}</p>
      <p className="mt-1 text-xs text-gold-200/45">{hint}</p>
    </motion.div>
  )
}

export default function Dashboard({ go, doctor }) {
  const { tx } = useT()
  const today = todayISO()
  const month = today.slice(0, 7)
  const [backupOpen, setBackupOpen] = useState(false)
  const { t } = useT()
  const hour = new Date().getHours()
  const greet = t(hour < 12 ? 'greet.morning' : hour < 17 ? 'greet.afternoon' : 'greet.evening')
  const backup = useLiveQuery(() => backupStatus(), [])
  const data = useLiveQuery(async () => {
    const [patients, visits] = await Promise.all([db.patients.toArray(), db.visits.toArray()])
    const byId = Object.fromEntries(patients.map(p => [p.id, p]))
    const todayVisits = visits.filter(v => v.date === today)
    const monthVisits = visits.filter(v => (v.date || '').startsWith(month))
    const revenue = monthVisits.reduce((s, v) => s + (v.payMode !== 'Pending' ? Number(v.fee) || 0 : 0), 0)
    const due = visits.filter(v => v.followUp && v.followUp <= today)
    const latestByPatient = {}
    for (const v of visits) {
      if (!latestByPatient[v.patientId] || v.date > latestByPatient[v.patientId].date) latestByPatient[v.patientId] = v
    }
    const dueNow = Object.values(latestByPatient).filter(v => v.followUp && v.followUp <= today)
    const dept = DEPARTMENTS.map(d => ({ key: d.key, n: monthVisits.filter(v => v.department === d.key).length }))
    const recent = [...visits].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 6).map(v => ({ ...v, patient: byId[v.patientId] })).filter(v => v.patient)
    return { total: patients.length, todayN: todayVisits.length, revenue, due: dueNow.length, overdue: due.length, dept, recent, monthN: monthVisits.length }
  }, [today])

  if (!data) return null
  const maxDept = Math.max(1, ...data.dept.map(d => d.n))

  return (
    <div>
      {backup?.due && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-300/35 bg-gradient-to-r from-amber-400/10 via-night-800/70 to-night-800/70 p-4 backdrop-blur-xl sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3">
            <ShieldAlert size={22} className="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold text-amber-100">{t('dash.backupTitle')}</p>
              <p className="text-xs text-gold-200/55">{backup.days === null ? t('dash.backupNever') : t('dash.backupDays', { n: backup.days })}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => snoozeReminder()} className="btn-ghost px-3 py-2 text-xs">{t('dash.tomorrow')}</button>
            <button onClick={() => setBackupOpen(true)} className="btn-gold px-4 py-2 text-xs"><Lock size={14} /> {t('dash.backupNow')}</button>
          </div>
        </motion.div>
      )}
      <BackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
      <motion.div {...fade(0)} className="glass relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-royal-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-6 hidden opacity-[.14] sm:block">
          <img src="./icons/crest.png" alt="" className="h-48 w-48 object-contain" />
        </div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.22em] text-gold-500/80">
          <Sparkles size={14} /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight gold-text sm:text-5xl">{greet}{doctor ? `, ${doctor}` : ''}</h1>
        <p className="mt-2 max-w-lg text-sm text-gold-200/55">
          {data.todayN ? t('dash.todayN', { n: data.todayN }) : t('dash.todayNone')} {data.due ? t('dash.dueN', { n: data.due }) : t('dash.dueNone')}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => go({ name: 'patients' })} className="btn-gold">{t('dash.openPatients')} <ChevronRight size={16} /></button>
          <button onClick={() => go({ name: 'followups' })} className="btn-ghost">{t('dash.followups')}</button>
          <button onClick={() => go({ name: 'reports' })} className="btn-ghost"><BarChart3 size={16} /> {t('dash.reports')}</button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat i={1} icon={Users} label={t('dash.patients')} value={data.total} hint={t('dash.patientsHint')} />
        <Stat i={2} icon={Stethoscope} label={t('dash.today')} value={data.todayN} hint={t('dash.todayHint')} />
        <Stat i={3} icon={IndianRupee} label={t('dash.month')} value={fmtMoney(data.revenue)} hint={t('dash.monthHint', { n: data.monthN })} />
        <Stat i={4} icon={CalendarClock} label={t('dash.followups')} value={data.due} hint={t('dash.followupsHint')} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <motion.div {...fade(5)} className="glass p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-2xl font-semibold text-gold-200">{t('dash.recent')}</h3>
            <button onClick={() => go({ name: 'patients' })} className="text-xs font-semibold text-gold-400 hover:text-gold-300">{t('dash.viewAll')}</button>
          </div>
          {data.recent.length === 0 ? (
            <Empty icon={Stethoscope} title={tx('No consultations yet')} text={tx('Register a patient and record the first consultation to see it here.')} />
          ) : (
            <ul className="divide-y divide-gold-500/10">
              {data.recent.map(v => (
                <li key={v.id}>
                  <button onClick={() => go({ name: 'patient', id: v.patientId })} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-night-700/40">
                    <Avatar name={v.patient.name} gender={v.patient.gender} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gold-200">{v.patient.name}</p>
                      <p className="truncate text-xs text-gold-200/45">{v.diagnosis || v.complaints || '—'}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <DeptChip dept={v.department} />
                      <p className="mt-1 text-[11px] text-gold-200/40">{fmtDate(v.date)}</p>
                    </div>
                    <ChevronRight size={16} className="text-gold-500/50" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        <motion.div {...fade(6)} className="glass p-5 lg:col-span-2">
          <h3 className="font-display text-2xl font-semibold text-gold-200">{t('dash.departments')}</h3>
          <p className="mb-5 text-xs text-gold-200/45">{t('dash.departmentsHint')}</p>
          <div className="space-y-4">
            {data.dept.map((d, i) => (
              <div key={d.key}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-gold-200/80">{t(`dept.${d.key}`)}</span>
                  <span className="font-semibold text-gold-300">{d.n}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-night-950/70">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(d.n / maxDept) * 100}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: `var(--dept-${d.key.toLowerCase()})` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
