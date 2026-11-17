import { useEffect, useState } from 'react'
import { Modal, Field, useToast } from './ui.jsx'
import { markPaid, PAY_MODES } from '../lib/db.js'
import { fmtDate, fmtMoney, todayISO } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'

export default function MarkPaid({ visit, patient, onClose }) {
  const { tx } = useT()
  const [mode, setMode] = useState('Cash')
  const [date, setDate] = useState(todayISO())
  const toast = useToast()

  useEffect(() => {
    if (visit) {
      setMode('Cash')
      setDate(todayISO())
    }
  }, [visit])

  const save = async () => {
    await markPaid(visit.id, mode, date)
    toast(`${fmtMoney(visit.fee)} collected via ${mode}`)
    onClose()
  }

  return (
    <Modal open={!!visit} onClose={onClose} title={tx('Collect payment')} subtitle={visit && patient ? `${patient.name} · consultation of ${fmtDate(visit.date)}` : ''}>
      {visit && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gold-500/15 bg-night-950/50 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-gold-400/80">{tx('Amount due')}</p>
            <p className="mt-1 font-display text-4xl font-bold gold-text">{fmtMoney(visit.fee)}</p>
          </div>
          <div>
            <span className="label">{tx('Paid by')}</span>
            <div className="grid grid-cols-3 gap-2">
              {PAY_MODES.map(m => (
                <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-xl border py-3 text-sm font-semibold transition ${mode === m ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Field label={tx('Collected on')}>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost">{tx('Cancel')}</button>
            <button onClick={save} className="btn-gold">{tx('Mark as paid')}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
