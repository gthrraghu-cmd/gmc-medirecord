import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Trash2, Wallet, ReceiptIndianRupee } from 'lucide-react'
import { db, EXPENSE_CATEGORIES, EXPENSE_MODES, deleteExpense, saveExpense } from '../lib/db.js'
import { fmtDate, fmtMoney, todayISO } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'
import { Empty, Field, useToast } from './ui.jsx'
import { BarList } from './charts.jsx'

const pad = n => String(n).padStart(2, '0')

export default function Expenses() {
  const { tx } = useT()
  const toast = useToast()
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [f, setF] = useState({ date: todayISO(), category: 'Medicines & supplies', amount: '', mode: 'Cash', note: '' })
  const list = useLiveQuery(() => db.expenses.where('date').startsWith(month).toArray().then(a => a.sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt))), [month])

  const totals = useMemo(() => {
    if (!list) return null
    const by = {}
    list.forEach(e => { by[e.category] = (by[e.category] || 0) + Number(e.amount || 0) })
    return {
      total: list.reduce((s, e) => s + Number(e.amount || 0), 0),
      items: Object.entries(by).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label: tx(label), value }))
    }
  }, [list, tx])

  if (!list) return null

  const shift = d => {
    const [y, m] = month.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setMonth(`${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`)
  }
  const monthLabel = new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const add = async e => {
    e.preventDefault()
    if (!(Number(f.amount) > 0)) return toast(tx('Enter the amount'), 'err')
    await saveExpense({ ...f, amount: Number(f.amount) })
    toast(`${tx('Expense added')} · ${fmtMoney(f.amount)}`)
    setF(s => ({ ...s, amount: '', note: '' }))
    if (f.date.slice(0, 7) !== month) setMonth(f.date.slice(0, 7))
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <form onSubmit={add} className="glass min-w-0 space-y-4 p-5 lg:col-span-2 lg:self-start">
        <h3 className="flex items-center gap-2 font-display text-2xl font-semibold text-gold-200"><ReceiptIndianRupee size={20} className="text-gold-400" /> {tx('Add expense')}</h3>
        <div>
          <span className="label">{tx('Category')}</span>
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map(c => (
              <button type="button" key={c} onClick={() => setF(s => ({ ...s, category: c }))} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${f.category === c ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>{tx(c)}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tx('Amount (₹)')}>
            <input type="number" min="0" inputMode="decimal" className="input" value={f.amount} onChange={e => setF(s => ({ ...s, amount: e.target.value }))} autoFocus />
          </Field>
          <Field label={tx('Date')}>
            <input type="date" className="input" value={f.date} onChange={e => setF(s => ({ ...s, date: e.target.value }))} />
          </Field>
        </div>
        <div>
          <span className="label">{tx('Paid by')}</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {EXPENSE_MODES.map(m => (
              <button type="button" key={m} onClick={() => setF(s => ({ ...s, mode: m }))} className={`rounded-lg border py-2 text-xs font-semibold transition ${f.mode === m ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>{tx(m)}</button>
            ))}
          </div>
        </div>
        <Field label={tx('Note')}>
          <input className="input" value={f.note} onChange={e => setF(s => ({ ...s, note: e.target.value }))} placeholder="Medicine purchase — SBL" />
        </Field>
        <button className="btn-gold w-full"><Plus size={16} /> {tx('Add expense')}</button>
      </form>

      <div className="min-w-0 space-y-4 lg:col-span-3">
        <div className="glass flex items-center justify-between gap-2 p-2">
          <button onClick={() => shift(-1)} className="btn-ghost px-3" aria-label={tx('Previous month')}><ChevronLeft size={18} /></button>
          <div className="text-center">
            <p className="font-display text-2xl font-semibold text-gold-200">{monthLabel}</p>
            <p className="text-xs text-gold-200/50">{tx('Total spent')} <span className="font-semibold text-gold-200">{fmtMoney(totals.total)}</span></p>
          </div>
          <button onClick={() => shift(1)} disabled={month >= todayISO().slice(0, 7)} className="btn-ghost px-3" aria-label={tx('Next month')}><ChevronRight size={18} /></button>
        </div>

        {list.length === 0 ? (
          <div className="glass"><Empty icon={Wallet} title={tx('No expenses this month')} text={tx('Record rent, salaries, medicine purchases and bills to see your real profit in Reports.')} /></div>
        ) : (
          <>
            <div className="glass p-5">
              <BarList items={totals.items} format={fmtMoney} color="var(--series-exp)" />
            </div>
            <ul className="glass divide-y divide-gold-500/10 p-2">
              {list.map((e, i) => (
                <motion.li key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="flex items-center gap-3 px-2 py-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="font-display text-xl font-bold leading-none text-gold-300">{e.date.slice(8, 10)}</p>
                    <p className="text-[10px] uppercase text-gold-200/40">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gold-200">{tx(e.category)}</p>
                    <p className="truncate text-xs text-gold-200/45">{[tx(e.mode), e.note].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="font-display text-xl font-semibold text-gold-200">{fmtMoney(e.amount)}</span>
                  <button onClick={async () => { await deleteExpense(e.id); toast(tx('Expense deleted')) }} className="rounded-lg p-1.5 text-gold-300/50 hover:bg-rose-500/10 hover:text-rose-300" aria-label={tx('Delete')}><Trash2 size={14} /></button>
                </motion.li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
