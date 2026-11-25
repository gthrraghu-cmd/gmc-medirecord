import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarPlus, UserRoundPlus, ChevronLeft, ChevronRight, Megaphone, CheckCheck, FolderOpen, LogIn, UserX, XCircle, MessageCircle, Pencil, Trash2, Clock, CalendarDays, ListOrdered, ChevronDown } from 'lucide-react'
import { db, APPT_STATUS, checkIn, setApptStatus, deleteAppointment } from '../lib/db.js'
import { addDaysISO, fmtDate, fmtTime, todayISO, weekDays } from '../lib/format.js'
import { apptText, waLink } from '../lib/share.js'
import { Avatar, DeptChip, Empty, PageHeader, useToast } from '../components/ui.jsx'
import AppointmentForm from './AppointmentForm.jsx'
import { useT } from '../lib/i18n.jsx'

function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function mins(from, now) {
  if (!from) return ''
  const m = Math.max(0, Math.round((now - from) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

function StatusChip({ status }) {
  const { tx } = useT()
  const s = APPT_STATUS[status] || APPT_STATUS.booked
  return <span className={`chip ${s.tone}`}>{tx(s.label)}</span>
}

function TokenBadge({ token, big, live }) {
  const { tx } = useT()
  if (big) {
    return (
      <div className="relative grid h-32 w-32 shrink-0 place-items-center sm:h-40 sm:w-40">
        {live && <motion.span className="absolute inset-0 rounded-full border-2 border-gold-400/50" animate={{ scale: [1, 1.12, 1], opacity: [0.8, 0, 0.8] }} transition={{ duration: 2.4, repeat: Infinity }} />}
        <div className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 p-[3px] shadow-gold">
          <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold-400/80">{tx('Token')}</p>
              <p className="font-display text-6xl font-bold leading-none gold-text sm:text-7xl">{token ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold-400/40 bg-gold-500/10">
      <span className="font-display text-xl font-bold gold-text">{token ?? '·'}</span>
    </div>
  )
}

function Section({ title, count, children, collapsible, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass p-4 sm:p-5">
      <button type="button" onClick={() => collapsible && setOpen(o => !o)} className={`flex w-full items-center justify-between ${collapsible ? '' : 'cursor-default'}`}>
        <h3 className="font-display text-2xl font-semibold text-gold-200">{title} <span className="ml-1 text-base text-gold-400/70">{count}</span></h3>
        {collapsible && <ChevronDown size={18} className={`text-gold-400 transition ${open ? 'rotate-180' : ''}`} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function IconBtn({ onClick, label, children, tone = '' }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`grid h-9 w-9 place-items-center rounded-lg border border-gold-500/15 text-gold-300/80 transition hover:border-gold-500/40 hover:bg-night-600/60 hover:text-gold-200 ${tone}`}>
      {children}
    </button>
  )
}

export default function Schedule({ go, profile, open, nonce }) {
  const { tx } = useT()
  const toast = useToast()
  const now = useNow()
  const today = todayISO()
  const [tab, setTab] = useState('queue')
  const [day, setDay] = useState(today)
  const [form, setForm] = useState(null)
  const { t: tr } = useT()

  useEffect(() => {
    if (open === 'book') setForm({ defaults: { date: todayISO() } })
    else if (open === 'walkin') setForm({ walkin: true })
  }, [open, nonce])

  const all = useLiveQuery(async () => {
    const [patients, appts] = await Promise.all([db.patients.toArray(), db.appointments.toArray()])
    const byId = Object.fromEntries(patients.map(p => [p.id, p]))
    return appts.map(a => ({ ...a, patient: byId[a.patientId] })).filter(a => a.patient)
  }, [])

  const week = useMemo(() => weekDays(day), [day])

  if (!all) return null

  const todays = all.filter(a => a.date === today)
  const withDoctor = todays.filter(a => a.status === 'in').sort((a, b) => (b.calledAt || 0) - (a.calledAt || 0))
  const waiting = todays.filter(a => a.status === 'waiting').sort((a, b) => (a.token || 0) - (b.token || 0))
  const expected = todays.filter(a => a.status === 'booked').sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
  const closed = todays.filter(a => ['done', 'noshow', 'cancelled'].includes(a.status)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  const serving = withDoctor[0]

  const call = async a => {
    for (const w of withDoctor) if (w.id !== a.id) await setApptStatus(w.id, 'done')
    await setApptStatus(a.id, 'in')
    toast(`Token ${a.token} · ${a.patient.name} called in`)
  }

  const callNext = () => {
    if (waiting[0]) call(waiting[0])
  }

  const doCheckIn = async a => {
    const token = await checkIn(a.id)
    toast(`${a.patient.name} checked in · Token ${token}`)
  }

  const setStatus = async (a, status, msg) => {
    await setApptStatus(a.id, status)
    toast(msg)
  }

  const counts = Object.fromEntries(week.map(d => [d, all.filter(a => a.date === d && !['cancelled'].includes(a.status)).length]))
  const dayList = all.filter(a => a.date === day).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
  const confirmHref = a => (a.patient.phone ? waLink(a.patient.phone, apptText(profile, a.patient, a, fmtTime(a.time))) : null)

  return (
    <div>
      <PageHeader eyebrow={tr('schedule.eyebrow')} title={tr('schedule.title')}>
        <button onClick={() => setForm({ walkin: true })} className="btn-gold"><UserRoundPlus size={16} /> {tr('schedule.walkin')}</button>
        <button onClick={() => setForm({ defaults: { date: tab === 'calendar' && day >= today ? day : today } })} className="btn-ghost"><CalendarPlus size={16} /> {tr('schedule.book')}</button>
      </PageHeader>

      <div className="mb-5 flex gap-2">
        {[
          { key: 'queue', label: tr('schedule.queue'), icon: ListOrdered, count: waiting.length },
          { key: 'calendar', label: tr('schedule.calendar'), icon: CalendarDays }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
            <t.icon size={16} /> {t.label}
            {t.count !== undefined && <span className="rounded-full bg-night-600 px-2 py-0.5 text-[10px] text-gold-300">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass relative overflow-hidden p-5 sm:p-7 lg:col-span-2">
              <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-royal-500/25 blur-3xl" />
              <p className="relative text-[11px] font-semibold uppercase tracking-[.24em] text-gold-500/90">{tr('schedule.now')}</p>
              {serving ? (
                <div className="relative mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                  <TokenBadge token={serving.token} big live />
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h2 className="font-display text-4xl font-semibold leading-tight gold-text">{serving.patient.name}</h2>
                    <p className="mt-1 text-sm text-gold-200/55">{serving.patient.code} · {serving.purpose || 'Consultation'}</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                      <DeptChip dept={serving.department} />
                      <span className="chip border-gold-500/20 text-gold-200/60"><Clock size={11} /> {tx('with doctor')} {mins(serving.calledAt, now)}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
                      <button onClick={() => go({ name: 'patient', id: serving.patientId })} className="btn-gold"><FolderOpen size={16} /> {tx('Open record')}</button>
                      <button onClick={() => setStatus(serving, 'done', `Token ${serving.token} completed`)} className="btn-ghost"><CheckCheck size={16} /> {tx('Mark done')}</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative mt-4 flex flex-col items-center gap-5 sm:flex-row">
                  <TokenBadge big />
                  <div className="text-center sm:text-left">
                    <h2 className="font-display text-3xl font-semibold text-gold-200">{tx('The doctor is free')}</h2>
                    <p className="mt-1 text-sm text-gold-200/50">{waiting.length ? `${waiting.length} patient${waiting.length > 1 ? 's' : ''} waiting. Call the next token when ready.` : 'No one is waiting. Check in an arrival or add a walk-in.'}</p>
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="glass flex flex-col p-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Waiting', waiting.length], ['Expected', expected.length], ['Done', closed.filter(c => c.status === 'done').length]].map(([l, n]) => (
                  <div key={l} className="rounded-xl border border-gold-500/10 bg-night-950/40 py-3">
                    <p className="font-display text-3xl font-bold gold-text">{n}</p>
                    <p className="text-[10px] uppercase tracking-[.16em] text-gold-200/45">{tx(l)}</p>
                  </div>
                ))}
              </div>
              <button onClick={callNext} disabled={!waiting.length} className="btn-gold mt-4 w-full py-4 text-base">
                <Megaphone size={18} /> {waiting[0] ? `${tr('schedule.callNext')} · ${waiting[0].token}` : tx('No one waiting')}
              </button>
              <p className="mt-2 text-center text-[11px] text-gold-200/35">{tx('Calling the next token completes the current one')}</p>
            </motion.div>
          </div>

          <Section title={tr('schedule.waiting')} count={waiting.length}>
            {waiting.length === 0 ? (
              <p className="py-6 text-center text-sm text-gold-200/40">{tx('The waiting area is empty.')}</p>
            ) : (
              <ul className="divide-y divide-gold-500/10">
                {waiting.map(a => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <TokenBadge token={a.token} />
                    <button onClick={() => go({ name: 'patient', id: a.patientId })} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-gold-200">{a.patient.name}</p>
                      <p className="truncate text-xs text-gold-200/45">{a.walkIn ? tx('Walk-in') : `Booked ${fmtTime(a.time)}`} · waiting {mins(a.checkedInAt, now)}</p>
                    </button>
                    <span className="hidden sm:inline"><DeptChip dept={a.department} /></span>
                    <button onClick={() => call(a)} className="btn-gold px-3 py-2 text-xs"><Megaphone size={14} /> {tx('Call')}</button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={tr('schedule.expected')} count={expected.length}>
            {expected.length === 0 ? (
              <p className="py-6 text-center text-sm text-gold-200/40">{tx('No more booked arrivals today.')}</p>
            ) : (
              <ul className="divide-y divide-gold-500/10">
                {expected.map(a => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="w-16 shrink-0 text-center">
                      <p className="font-display text-lg font-semibold text-gold-300">{fmtTime(a.time).replace(/ (AM|PM)$/, '')}</p>
                      <p className="text-[10px] uppercase tracking-wider text-gold-200/40">{a.time ? fmtTime(a.time).slice(-2) : ''}</p>
                    </div>
                    <Avatar name={a.patient.name} gender={a.patient.gender} />
                    <button onClick={() => go({ name: 'patient', id: a.patientId })} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-gold-200">{a.patient.name}</p>
                      <p className="truncate text-xs text-gold-200/45">{a.purpose || 'Consultation'} · {a.department}</p>
                    </button>
                    <div className="flex w-full justify-end gap-1.5 sm:w-auto">
                      <IconBtn onClick={() => setStatus(a, 'noshow', `${a.patient.name} marked no-show`)} label={tx('No-show')}><UserX size={15} /></IconBtn>
                      <IconBtn onClick={() => setStatus(a, 'cancelled', 'Appointment cancelled')} label={tx('Cancel')}><XCircle size={15} /></IconBtn>
                      <button onClick={() => doCheckIn(a)} className="btn-gold px-3 py-2 text-xs"><LogIn size={14} /> {tx('Check in')}</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={tr('schedule.completed')} count={closed.length} collapsible defaultOpen={false}>
            {closed.length === 0 ? (
              <p className="py-6 text-center text-sm text-gold-200/40">{tx('Nothing completed yet today.')}</p>
            ) : (
              <ul className="divide-y divide-gold-500/10">
                {closed.map(a => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 opacity-80">
                    <TokenBadge token={a.token} />
                    <button onClick={() => go({ name: 'patient', id: a.patientId })} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-gold-200">{a.patient.name}</p>
                      <p className="truncate text-xs text-gold-200/45">{a.purpose || 'Consultation'}</p>
                    </button>
                    <StatusChip status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === 'calendar' && (
        <div>
          <div className="glass mb-4 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button onClick={() => setDay(d => addDaysISO(d, -7))} className="btn-ghost px-3" aria-label={tx('Previous week')}><ChevronLeft size={18} /></button>
              <div className="text-center">
                <p className="font-display text-2xl font-semibold text-gold-200">{new Date(week[0] + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                {!week.includes(today) && <button onClick={() => setDay(today)} className="text-xs font-semibold text-gold-400 hover:text-gold-300">{tx('Back to this week')}</button>}
              </div>
              <button onClick={() => setDay(d => addDaysISO(d, 7))} className="btn-ghost px-3" aria-label={tx('Next week')}><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {week.map(d => {
                const dt = new Date(d + 'T00:00:00')
                const sel = d === day
                const isToday = d === today
                return (
                  <button key={d} onClick={() => setDay(d)} className={`relative flex flex-col items-center rounded-xl border py-2.5 transition sm:py-3 ${sel ? 'border-gold-400 bg-gradient-to-b from-gold-500/25 to-gold-500/5' : 'border-gold-500/10 hover:border-gold-500/35'}`}>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${sel ? 'text-gold-300' : 'text-gold-200/45'}`}>{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                    <span className={`font-display text-2xl font-bold leading-tight ${sel ? 'gold-text' : isToday ? 'text-gold-300' : 'text-gold-200/80'}`}>{dt.getDate()}</span>
                    <span className={`mt-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4 ${counts[d] ? 'bg-royal-500/60 text-white' : 'text-transparent'}`}>{counts[d] || 0}</span>
                    {isToday && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold-400" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-3 flex items-end justify-between">
            <h3 className="font-display text-2xl font-semibold text-gold-200">{day === today ? tx('Today') : new Date(day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
            <span className="text-xs text-gold-200/45">{dayList.length} appointment{dayList.length === 1 ? '' : 's'}</span>
          </div>

          {dayList.length === 0 ? (
            <div className="glass">
              <Empty icon={CalendarDays} title={tx('No appointments')} text={tx('Nothing is booked for this day yet.')} action={day >= today && <button onClick={() => setForm({ defaults: { date: day } })} className="btn-gold"><CalendarPlus size={16} /> Book on {fmtDate(day).slice(0, 6)}</button>} />
            </div>
          ) : (
            <div className="space-y-2.5">
              {dayList.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className={`glass flex flex-wrap items-center gap-3 p-3.5 sm:p-4 ${['cancelled', 'noshow'].includes(a.status) ? 'opacity-60' : ''}`}>
                  <div className="w-16 shrink-0 border-r border-gold-500/15 pr-3 text-center">
                    <p className="font-display text-lg font-semibold leading-tight text-gold-300">{a.time ? fmtTime(a.time).replace(/ (AM|PM)$/, '') : '—'}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gold-200/40">{a.time ? fmtTime(a.time).slice(-2) : 'Any'}</p>
                  </div>
                  <Avatar name={a.patient.name} gender={a.patient.gender} />
                  <button onClick={() => go({ name: 'patient', id: a.patientId })} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold text-gold-200">{a.patient.name}{a.token ? <span className="ml-2 text-xs text-gold-400">#{a.token}</span> : null}</p>
                    <p className="truncate text-xs text-gold-200/45">{a.purpose || 'Consultation'} · {a.department}</p>
                  </button>
                  <StatusChip status={a.status} />
                  <div className="flex w-full justify-end gap-1.5 sm:w-auto">
                    {a.status === 'booked' && confirmHref(a) && (
                      <a href={confirmHref(a)} target="_blank" rel="noopener noreferrer" title={tx('Send confirmation on WhatsApp')} aria-label={tx('Send confirmation on WhatsApp')} className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"><MessageCircle size={15} /></a>
                    )}
                    {a.status === 'booked' && <IconBtn onClick={() => setForm({ appt: a })} label={tx('Edit')}><Pencil size={15} /></IconBtn>}
                    {a.status === 'booked' && a.date < today && <IconBtn onClick={() => setStatus(a, 'noshow', 'Marked no-show')} label={tx('No-show')}><UserX size={15} /></IconBtn>}
                    {a.status === 'booked' && <IconBtn onClick={() => setStatus(a, 'cancelled', 'Appointment cancelled')} label={tx('Cancel')}><XCircle size={15} /></IconBtn>}
                    {['cancelled', 'noshow'].includes(a.status) && <IconBtn onClick={async () => { await deleteAppointment(a.id); toast(tx('Appointment removed')) }} label={tx('Delete')} tone="hover:text-rose-300"><Trash2 size={15} /></IconBtn>}
                    {a.status === 'booked' && a.date === today && <button onClick={() => doCheckIn(a)} className="btn-gold px-3 py-2 text-xs"><LogIn size={14} /> {tx('Check in')}</button>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      <AppointmentForm open={!!form} onClose={() => setForm(null)} appt={form?.appt} defaults={form?.defaults} walkin={form?.walkin} onSaved={d => { if (!form?.walkin && d) setDay(d) }} />
    </div>
  )
}
