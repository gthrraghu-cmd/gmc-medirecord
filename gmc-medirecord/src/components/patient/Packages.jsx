import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, PackageCheck, PackageOpen, Archive } from 'lucide-react'
import { db, savePackage, deletePackage } from '../../lib/db.js'
import { fmtDate, fmtMoney, todayISO } from '../../lib/format.js'
import { DeptChip, Empty, Field, Modal, useToast } from '../ui.jsx'
import { useT } from '../../lib/i18n.jsx'

const PRESETS = [
  { name: 'Acupuncture · 10 sessions', department: 'Acupuncture', totalSessions: 10 },
  { name: 'Acupuncture · 6 sessions', department: 'Acupuncture', totalSessions: 6 },
  { name: 'Chemical peel · 4 sessions', department: 'Cosmetology', totalSessions: 4 },
  { name: 'PRP hair · 6 sessions', department: 'Cosmetology', totalSessions: 6 }
]

function Ring({ used, total }) {
  const { tx } = useT()
  const pct = total ? Math.min(1, used / total) : 0
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ringGold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f3dc9b" />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(212,165,55,.15)" strokeWidth="6" />
        <motion.circle cx="40" cy="40" r={r} fill="none" stroke="url(#ringGold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-2xl font-bold leading-none gold-text">{used}<span className="text-base text-gold-400/70">/{total}</span></p>
          <p className="text-[9px] uppercase tracking-wider text-gold-200/45">{tx('sessions')}</p>
        </div>
      </div>
    </div>
  )
}

function PackageForm({ open, onClose, pkg, patient }) {
  const { tx } = useT()
  const toast = useToast()
  const [f, setF] = useState({})

  useEffect(() => {
    if (open) setF(pkg ? { ...pkg } : { name: '', department: 'Acupuncture', totalSessions: 10, price: '', amountPaid: '', startDate: todayISO(), notes: '' })
  }, [open, pkg])

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!f.name?.trim()) return toast(tx('Give the package a name'), 'err')
    if (!(Number(f.totalSessions) > 0)) return toast(tx('Sessions must be at least 1'), 'err')
    await savePackage({ ...f, name: f.name.trim(), totalSessions: Number(f.totalSessions), patientId: patient.id })
    toast(pkg ? tx('Package updated') : tx('Package started'))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={pkg ? tx('Edit package') : tx('New package')} subtitle={patient.name}>
      <form onSubmit={submit} className="space-y-5">
        {!pkg && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button type="button" key={p.name} onClick={() => setF(s => ({ ...s, ...p }))} className="chip border-gold-500/25 py-1.5 text-gold-300 hover:bg-gold-500/10">{p.name}</button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tx('Package name')} className="sm:col-span-2">
            <input className="input" value={f.name || ''} onChange={set('name')} placeholder="Back pain programme · 10 sessions" />
          </Field>
          <Field label={tx('Department')}>
            <select className="input" value={f.department} onChange={set('department')}>
              <option value="Acupuncture">{tx('Acupuncture')}</option>
              <option value="Cosmetology">{tx('Cosmetology')}</option>
            </select>
          </Field>
          <Field label={tx('Total sessions')}>
            <input type="number" min="1" className="input" value={f.totalSessions} onChange={set('totalSessions')} />
          </Field>
          <Field label={tx('Package price (₹)')}>
            <input type="number" min="0" className="input" value={f.price} onChange={set('price')} />
          </Field>
          <Field label={tx('Amount paid (₹)')}>
            <input type="number" min="0" className="input" value={f.amountPaid} onChange={set('amountPaid')} />
          </Field>
          <Field label={tx('Start date')}>
            <input type="date" className="input" value={f.startDate} onChange={set('startDate')} />
          </Field>
          <Field label={tx('Notes')} className="sm:col-span-2">
            <textarea rows="2" className="input" value={f.notes || ''} onChange={set('notes')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">{tx('Cancel')}</button>
          <button className="btn-gold">{pkg ? tx('Save changes') : tx('Start package')}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Packages({ patient }) {
  const { tx } = useT()
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const data = useLiveQuery(async () => {
    const [pkgs, visits] = await Promise.all([db.packages.where('patientId').equals(patient.id).toArray(), db.visits.where('patientId').equals(patient.id).toArray()])
    return pkgs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(p => ({ ...p, sessions: visits.filter(v => v.packageId === p.id).sort((a, b) => a.date.localeCompare(b.date)) }))
  }, [patient.id])

  if (!data) return null

  const close = async p => {
    await savePackage({ id: p.id, status: p.status === 'closed' ? 'active' : 'closed' })
    toast(p.status === 'closed' ? tx('Package reopened') : tx('Package closed'))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl font-semibold text-gold-200">{tx('Treatment packages')}</h3>
          <p className="text-xs text-gold-200/45">{tx('Acupuncture and cosmetology courses with sessions used and left')}</p>
        </div>
        <button onClick={() => setForm({})} className="btn-gold"><Plus size={16} /> {tx('Package')}</button>
      </div>

      {data.length === 0 ? (
        <div className="glass">
          <Empty icon={PackageOpen} title={tx('No packages yet')} text={tx('Start a package, then pick it while recording each Acupuncture or Cosmetology visit to count sessions automatically.')} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.map((p, i) => {
            const used = p.sessions.length
            const left = Math.max(0, Number(p.totalSessions) - used)
            const balance = (Number(p.price) || 0) - (Number(p.amountPaid) || 0)
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`glass p-5 ${p.status === 'closed' ? 'opacity-60' : ''}`}>
                <div className="flex gap-4">
                  <Ring used={used} total={Number(p.totalSessions)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-xl font-semibold leading-tight text-gold-200">{p.name}</p>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => setForm({ pkg: p })} className="rounded-lg p-1.5 text-gold-300/60 hover:bg-night-600/50 hover:text-gold-200" aria-label={tx('Edit')}><Pencil size={14} /></button>
                        <button onClick={() => close(p)} className="rounded-lg p-1.5 text-gold-300/60 hover:bg-night-600/50 hover:text-gold-200" aria-label={p.status === 'closed' ? 'Reopen' : tx('Close')} title={p.status === 'closed' ? 'Reopen' : 'Close package'}><Archive size={14} /></button>
                        <button onClick={() => setConfirm(p)} className="rounded-lg p-1.5 text-gold-300/60 hover:bg-rose-500/10 hover:text-rose-300" aria-label={tx('Delete')}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <DeptChip dept={p.department} />
                      {p.status === 'completed' && <span className="chip border-emerald-300/30 text-emerald-200"><PackageCheck size={11} /> {tx('Completed')}</span>}
                      {p.status === 'closed' && <span className="chip border-gold-500/20 text-gold-200/50">{tx('Closed')}</span>}
                      {p.status === 'active' && <span className="chip border-gold-400/35 text-gold-300">{left} left</span>}
                    </div>
                    <p className="mt-2 text-xs text-gold-200/45">Started {fmtDate(p.startDate)}{p.price ? ` · ${fmtMoney(p.price)}` : ''}{balance > 0 ? ` · ` : ''}{balance > 0 && <span className="font-semibold text-rose-200">{fmtMoney(balance)} due</span>}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {Array.from({ length: Number(p.totalSessions) }).map((_, n) => {
                    const s = p.sessions[n]
                    return (
                      <span key={n} title={s ? fmtDate(s.date) : `Session ${n + 1}`} className={`grid h-8 min-w-8 place-items-center rounded-lg border px-1.5 text-[10px] font-semibold ${s ? 'border-gold-400/50 bg-gold-500/15 text-gold-200' : 'border-dashed border-gold-500/20 text-gold-200/30'}`}>
                        {s ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : n + 1}
                      </span>
                    )
                  })}
                </div>
                {p.notes && <p className="mt-3 text-xs text-gold-200/55">{p.notes}</p>}
              </motion.div>
            )
          })}
        </div>
      )}

      <PackageForm open={!!form} onClose={() => setForm(null)} pkg={form?.pkg} patient={patient} />
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={tx('Delete package?')}>
        <p className="text-sm text-gold-200/70">{tx('The package is removed. Its visits stay in the consultation history as single visits.')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setConfirm(null)} className="btn-ghost">{tx('Cancel')}</button>
          <button onClick={async () => { await deletePackage(confirm.id); setConfirm(null); toast(tx('Package deleted')) }} className="btn-danger"><Trash2 size={15} /> {tx('Delete')}</button>
        </div>
      </Modal>
    </div>
  )
}
