import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { CalendarClock, Phone, MessageCircle, CalendarPlus, CalendarCheck, Check } from 'lucide-react'
import { db, bookFollowUp, markReminded } from '../lib/db.js'
import { followUpText, waLink } from '../lib/share.js'
import { addDaysISO, fmtDate, todayISO } from '../lib/format.js'
import { Avatar, DeptChip, Empty, PageHeader, useToast } from '../components/ui.jsx'
import { useT } from '../lib/i18n.jsx'

const TABS = [
  { key: 'overdue', label: 'follow.overdue' },
  { key: 'today', label: 'follow.today' },
  { key: 'week', label: 'follow.week' },
  { key: 'all', label: 'follow.all' }
]

export default function FollowUps({ go, profile }) {
  const { tx } = useT()
  const toast = useToast()
  const [tab, setTab] = useState('today')
  const { t: tr } = useT()
  const today = todayISO()
  const week = addDaysISO(today, 7)

  const rows = useLiveQuery(async () => {
    const [patients, visits, appts] = await Promise.all([db.patients.toArray(), db.visits.toArray(), db.appointments.toArray()])
    const openDates = {}
    appts.filter(a => ['booked', 'waiting', 'in'].includes(a.status)).forEach(a => { (openDates[a.patientId] ||= []).push(a.date) })
    const isBooked = v => (openDates[v.patientId] || []).some(d => d === v.followUp || (v.followUp < today && d >= today))
    const byId = Object.fromEntries(patients.map(p => [p.id, p]))
    const latest = {}
    for (const v of visits) {
      if (!latest[v.patientId] || (v.date + v.createdAt) > (latest[v.patientId].date + latest[v.patientId].createdAt)) latest[v.patientId] = v
    }
    return Object.values(latest).filter(v => v.followUp && byId[v.patientId]).map(v => ({ ...v, patient: byId[v.patientId], booked: isBooked(v) })).sort((a, b) => a.followUp.localeCompare(b.followUp))
  }, [today])

  if (!rows) return null

  const groups = {
    overdue: rows.filter(r => r.followUp < today),
    today: rows.filter(r => r.followUp === today),
    week: rows.filter(r => r.followUp > today && r.followUp <= week),
    all: rows.filter(r => r.followUp >= today)
  }
  const list = groups[tab]
  const remindedToday = r => r.remindedAt && new Date(r.remindedAt).toDateString() === new Date().toDateString()
  const book = async r => {
    const res = await bookFollowUp(r.followUp < today ? { ...r, followUp: today } : r)
    toast(res.existed ? tx('Already booked') : `${tx('Booked')} · ${fmtDate(r.followUp < today ? today : r.followUp)}`)
  }

  return (
    <div>
      <PageHeader eyebrow={tr('follow.eyebrow')} title={tr('follow.title')} />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
            {tr(t.label)}
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${t.key === 'overdue' && groups.overdue.length ? 'bg-rose-500/20 text-rose-200' : 'bg-night-600 text-gold-300'}`}>{groups[t.key].length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="glass">
          <Empty icon={CalendarClock} title={tx('Nothing here')} text={tab === 'overdue' ? tx('No overdue follow-ups. Wonderful.') : tx('No follow-ups scheduled in this window.')} />
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} className="glass flex flex-wrap items-center gap-3 p-4">
              <div className={`hidden w-20 shrink-0 rounded-xl border p-2 text-center sm:block ${r.followUp < today ? 'border-rose-400/30 bg-rose-500/10' : 'border-gold-500/20 bg-night-950/50'}`}>
                <p className={`font-display text-2xl font-bold leading-none ${r.followUp < today ? 'text-rose-200' : 'gold-text'}`}>{r.followUp.slice(8, 10)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-gold-200/50">{new Date(r.followUp + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</p>
              </div>
              <Avatar name={r.patient.name} gender={r.patient.gender} />
              <button onClick={() => go({ name: 'patient', id: r.patientId })} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold text-gold-200">{r.patient.name}</p>
                <p className="truncate text-xs text-gold-200/45">{r.patient.code} · {tx('last seen')} {fmtDate(r.date)} · {r.diagnosis || r.complaints}</p>
                <p className={`mt-1 text-xs font-semibold sm:hidden ${r.followUp < today ? 'text-rose-300' : 'text-gold-400'}`}>{tx('Due')} {fmtDate(r.followUp)}</p>
              </button>
              <span className="hidden md:inline"><DeptChip dept={r.department} /></span>
              <div className="flex w-full justify-end gap-1.5 sm:w-auto">
                {r.patient.phone && (
                  <a href={`tel:${r.patient.phone}`} className="btn-ghost px-3" aria-label={tx('Call')} title={tx('Call')}><Phone size={15} /></a>
                )}
                {r.patient.phone && (
                  <a href={waLink(r.patient.phone, followUpText(profile, r.patient, r.followUp, r.followUp < today))} target="_blank" rel="noopener noreferrer" onClick={() => markReminded(r.id)} className={`btn px-3 ${remindedToday(r) ? 'border border-emerald-400/20 bg-emerald-500/5 text-emerald-200/70' : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'}`} title={tx('WhatsApp reminder')}>
                    {remindedToday(r) ? <Check size={15} /> : <MessageCircle size={15} />}<span className="text-xs">{remindedToday(r) ? tx('Reminded') : tx('Remind')}</span>
                  </a>
                )}
                {r.booked ? (
                  <span className="chip border-emerald-300/30 py-2 text-emerald-200"><CalendarCheck size={13} /> {tx('Booked')}</span>
                ) : (
                  <button onClick={() => book(r)} className="btn-gold px-3 py-2 text-xs"><CalendarPlus size={14} /> {tx('Book')}</button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
