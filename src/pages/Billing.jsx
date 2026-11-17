import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Printer, Wallet, Smartphone, CreditCard, IndianRupee, Clock, MessageCircle, BadgeCheck } from 'lucide-react'
import { db } from '../lib/db.js'
import { addDaysISO, fmtDate, fmtMoney, todayISO } from '../lib/format.js'
import { dueReminderText, waLink } from '../lib/share.js'
import { Avatar, DeptChip, Empty, PageHeader } from '../components/ui.jsx'
import { ClosingSheet } from '../components/PrintSheets.jsx'
import DocPreview from '../components/DocPreview.jsx'
import MarkPaid from '../components/MarkPaid.jsx'
import Expenses from '../components/Expenses.jsx'
import { useT } from '../lib/i18n.jsx'

const fee = v => Number(v.fee) || 0

function Tile({ icon: Icon, label, value, strong, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`glass p-4 ${strong ? 'border-gold-400/40' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold-400/80">{label}</span>
        <Icon size={16} className="text-gold-400" />
      </div>
      <p className={`mt-2 font-display font-bold gold-text ${strong ? 'text-4xl' : 'text-3xl'}`}>{value}</p>
    </motion.div>
  )
}

function daysAgo(iso) {
  const d = Math.round((new Date(todayISO() + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000)
  if (d <= 0) return 'Today'
  if (d === 1) return '1 day'
  return `${d} days`
}

export default function Billing({ go, profile }) {
  const { tx } = useT()
  const [tab, setTab] = useState('closing')
  const [date, setDate] = useState(todayISO())
  const [printOpen, setPrintOpen] = useState(false)
  const [collect, setCollect] = useState(null)
  const { t: tr } = useT()

  const data = useLiveQuery(async () => {
    const [patients, visits] = await Promise.all([db.patients.toArray(), db.visits.toArray()])
    const byId = Object.fromEntries(patients.map(p => [p.id, p]))
    return visits.map(v => ({ ...v, patient: byId[v.patientId] })).filter(v => v.patient)
  }, [])
  const dayExpenses = useLiveQuery(() => db.expenses.where('date').equals(date).toArray(), [date]) || []

  const summary = useMemo(() => {
    if (!data) return null
    const collectedRows = data.filter(v => v.payMode !== 'Pending' && fee(v) > 0 && (v.paidOn || v.date) === date)
    const pendingRows = data.filter(v => v.payMode === 'Pending' && v.date === date)
    const byMode = { Cash: 0, UPI: 0, Card: 0 }
    collectedRows.forEach(v => { byMode[v.payMode] = (byMode[v.payMode] || 0) + fee(v) })
    return {
      byMode,
      collected: collectedRows.reduce((s, v) => s + fee(v), 0),
      pending: pendingRows.reduce((s, v) => s + fee(v), 0),
      consults: data.filter(v => v.date === date).length,
      rows: [...collectedRows, ...pendingRows].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
      expenses: dayExpenses,
      spent: dayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
      cashSpent: dayExpenses.filter(e => e.mode === 'Cash').reduce((s, e) => s + Number(e.amount || 0), 0),
      cashInHand: (byMode.Cash || 0) - dayExpenses.filter(e => e.mode === 'Cash').reduce((s, e) => s + Number(e.amount || 0), 0)
    }
  }, [data, date, dayExpenses])

  const dues = useMemo(() => (data ? data.filter(v => v.payMode === 'Pending' && fee(v) > 0).sort((a, b) => a.date.localeCompare(b.date)) : []), [data])
  const duesTotal = dues.reduce((s, v) => s + fee(v), 0)

  if (!data || !summary) return null

  const reminder = v => dueReminderText(profile, v.patient, v)

  return (
    <div>
      <PageHeader eyebrow={tr('billing.eyebrow')} title={tr('billing.title')}>
        {tab === 'closing' && <button onClick={() => setPrintOpen(true)} className="btn-gold"><Printer size={16} /> {tr('billing.print')}</button>}
      </PageHeader>

      <div className="mb-5 flex gap-2">
        {[
          { key: 'closing', label: tr('billing.closing') },
          { key: 'dues', label: tr('billing.dues'), count: dues.length },
          { key: 'expenses', label: tx('Expenses') }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
            {t.label}
            {t.count !== undefined && <span className={`rounded-full px-2 py-0.5 text-[10px] ${t.count ? 'bg-rose-500/20 text-rose-200' : 'bg-night-600 text-gold-300'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'closing' && (
        <>
          <div className="glass mb-5 flex items-center justify-between gap-2 p-2">
            <button onClick={() => setDate(d => addDaysISO(d, -1))} className="btn-ghost px-3" aria-label={tx('Previous day')}><ChevronLeft size={18} /></button>
            <div className="flex flex-1 flex-col items-center sm:flex-row sm:justify-center sm:gap-3">
              <p className="font-display text-2xl font-semibold text-gold-200">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="input w-auto py-1.5 text-xs" />
            </div>
            <button onClick={() => setDate(d => addDaysISO(d, 1))} disabled={date >= todayISO()} className="btn-ghost px-3" aria-label={tx('Next day')}><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile i={0} icon={Wallet} label="Cash" value={fmtMoney(summary.byMode.Cash)} />
            <Tile i={1} icon={Smartphone} label="UPI" value={fmtMoney(summary.byMode.UPI)} />
            <Tile i={2} icon={CreditCard} label="Card" value={fmtMoney(summary.byMode.Card)} />
            <Tile i={3} icon={IndianRupee} label={tx('Collected')} value={fmtMoney(summary.collected)} strong />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="chip border-gold-500/25 text-gold-300">{summary.consults} {tx('Consultations')}</span>
            <span className={`chip ${summary.pending ? 'border-rose-300/30 text-rose-200' : 'border-gold-500/15 text-gold-200/50'}`}>{tx('Pending today')} {fmtMoney(summary.pending)}</span>
            {summary.spent > 0 && <span className="chip border-sky-300/30 text-sky-200">{tx('Expenses')} {fmtMoney(summary.spent)}</span>}
            <span className="chip border-emerald-300/30 text-emerald-200">{tx('Cash in hand')} {fmtMoney(summary.cashInHand)}</span>
          </div>

          <div className="glass mt-5 p-2 sm:p-4">
            {summary.rows.length === 0 ? (
              <Empty icon={IndianRupee} title={tx('No payments on this day')} text={tx('Consultations with a fee will appear here, split by Cash, UPI and Card.')} />
            ) : (
              <ul className="divide-y divide-gold-500/10">
                {summary.rows.map(v => (
                  <li key={v.id} className="flex items-center gap-3 px-2 py-3">
                    <Avatar name={v.patient.name} gender={v.patient.gender} />
                    <button onClick={() => go({ name: 'patient', id: v.patientId })} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-gold-200">{v.patient.name}</p>
                      <p className="truncate text-xs text-gold-200/45">{v.receiptNo || v.patient.code}{v.collectedLater && v.date !== date ? ` · due from ${fmtDate(v.date)}` : ''}</p>
                    </button>
                    <span className="hidden sm:inline"><DeptChip dept={v.department} /></span>
                    <span className={`chip ${v.payMode === 'Pending' ? 'border-rose-300/30 text-rose-200' : 'border-emerald-300/25 text-emerald-200'}`}>{v.payMode}</span>
                    <span className="w-20 text-right font-display text-xl font-semibold text-gold-200">{fmtMoney(fee(v))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === 'expenses' && <Expenses />}

      {tab === 'dues' && (
        <>
          <div className="glass mb-5 flex items-center justify-between p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold-400/80">{tx('Total outstanding')}</p>
              <p className="mt-1 font-display text-4xl font-bold gold-text">{fmtMoney(duesTotal)}</p>
            </div>
            <div className="text-right text-xs text-gold-200/50">
              <p>{dues.length} unpaid consultation{dues.length === 1 ? '' : 's'}</p>
              <p>{new Set(dues.map(d => d.patientId)).size} patient{new Set(dues.map(d => d.patientId)).size === 1 ? '' : 's'}</p>
            </div>
          </div>

          {dues.length === 0 ? (
            <div className="glass"><Empty icon={BadgeCheck} title={tx('All dues cleared')} text={tx('No pending payments. Every consultation is settled.')} /></div>
          ) : (
            <div className="space-y-3">
              {dues.map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} className="glass flex flex-wrap items-center gap-3 p-4">
                  <Avatar name={v.patient.name} gender={v.patient.gender} />
                  <button onClick={() => go({ name: 'patient', id: v.patientId })} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold text-gold-200">{v.patient.name}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-gold-200/45"><Clock size={11} /> {fmtDate(v.date)} · {daysAgo(v.date)} · {v.department}</p>
                  </button>
                  <span className="font-display text-2xl font-semibold text-rose-200">{fmtMoney(fee(v))}</span>
                  <div className="flex w-full gap-2 sm:w-auto">
                    {v.patient.phone && (
                      <a href={waLink(v.patient.phone, reminder(v))} target="_blank" rel="noopener noreferrer" className="btn flex-1 border border-emerald-400/30 bg-emerald-500/10 px-3 text-emerald-200 hover:bg-emerald-500/20 sm:flex-none" aria-label={tx('WhatsApp reminder')}>
                        <MessageCircle size={15} /><span className="sm:hidden">{tx('Remind')}</span>
                      </a>
                    )}
                    <button onClick={() => setCollect(v)} className="btn-gold flex-1 sm:flex-none">{tx('Collect')}</button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      <DocPreview open={printOpen} onClose={() => setPrintOpen(false)} title={tx('Daily closing')} subtitle={fmtDate(date)} sheet={<ClosingSheet profile={profile} date={date} summary={summary} />} />
      <MarkPaid visit={collect} patient={collect?.patient} onClose={() => setCollect(null)} />
    </div>
  )
}
