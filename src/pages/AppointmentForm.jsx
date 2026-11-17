import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Field, Modal, useToast } from '../components/ui.jsx'
import PatientPicker from '../components/PatientPicker.jsx'
import { db, DEPARTMENTS, findOpenAppointment, saveAppointment, walkIn } from '../lib/db.js'
import { fmtDate, fmtTime, TIME_SLOTS, todayISO } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'

const PURPOSES = ['Consultation', 'Follow-up', 'Acupuncture session', 'Cosmetology procedure', 'Review reports']

export default function AppointmentForm({ open, onClose, appt, defaults = {}, walkin, onSaved }) {
  const { tx } = useT()
  const toast = useToast()
  const [f, setF] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(appt ? { ...appt } : { patientId: null, date: todayISO(), time: '', department: 'Homoeopathy', purpose: walkin ? 'Walk-in' : 'Consultation', ...defaults })
  }, [open, appt, walkin])

  const patient = useLiveQuery(() => (f.patientId ? db.patients.get(f.patientId) : null), [f.patientId])
  const sameSlot = useLiveQuery(async () => {
    if (!f.date || !f.time) return 0
    const list = await db.appointments.where('date').equals(f.date).toArray()
    return list.filter(a => a.time === f.time && a.id !== f.id && !['cancelled', 'noshow'].includes(a.status)).length
  }, [f.date, f.time, f.id])

  useEffect(() => {
    if (patient && !appt && !defaults.department) setF(s => ({ ...s, department: patient.department || s.department }))
  }, [patient?.id])

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!f.patientId) return toast(tx('Choose or register a patient'), 'err')
    setBusy(true)
    try {
      if (walkin) {
        const token = await walkIn(f.patientId, f.department)
        toast(`Token ${token} issued to ${patient?.name || 'patient'}`)
      } else {
        if (!f.id) {
          const dup = await findOpenAppointment(f.patientId, f.date)
          if (dup) {
            setBusy(false)
            return toast(`Already booked on ${fmtDate(f.date)}`, 'err')
          }
        }
        await saveAppointment({ ...f })
        toast(f.id ? tx('Appointment updated') : `Booked for ${fmtDate(f.date)} · ${fmtTime(f.time)}`)
      }
      onSaved?.(f.date)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={walkin ? tx('Walk-in patient') : appt ? tx('Edit appointment') : tx('Book appointment')} subtitle={walkin ? tx('Checks in now and issues the next token') : tx('Reserve a slot for a registered or new patient')}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <span className="label">{tx('Patient')}</span>
          {appt ? (
            <p className="rounded-xl border border-gold-500/15 bg-night-950/50 px-4 py-3 text-sm font-semibold text-gold-200">{patient?.name} <span className="text-gold-200/40">· {patient?.code}</span></p>
          ) : (
            <PatientPicker value={f.patientId} onChange={id => setF(s => ({ ...s, patientId: id }))} department={f.department} autoFocus />
          )}
        </div>

        {!walkin && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tx('Date')}>
              <input type="date" className="input" min={appt ? undefined : todayISO()} value={f.date || ''} onChange={set('date')} />
            </Field>
            <Field label={tx('Time')}>
              <select className="input" value={f.time || ''} onChange={set('time')}>
                <option value="">{tx('Anytime')}</option>
                {TIME_SLOTS.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
              </select>
            </Field>
            {sameSlot > 0 && <p className="text-xs text-amber-200/80 sm:col-span-2">{sameSlot} other patient{sameSlot > 1 ? 's are' : ' is'} already booked at {fmtTime(f.time)}.</p>}
          </div>
        )}

        <div>
          <span className="label">{tx('Department')}</span>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map(d => (
              <button type="button" key={d.key} onClick={() => setF(s => ({ ...s, department: d.key }))} className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${f.department === d.key ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
                {tx(d.key)}
              </button>
            ))}
          </div>
        </div>

        {!walkin && (
          <Field label={tx('Purpose')}>
            <input className="input" list="appt-purposes" value={f.purpose || ''} onChange={set('purpose')} />
            <datalist id="appt-purposes">{PURPOSES.map(p => <option key={p} value={p} />)}</datalist>
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">{tx('Cancel')}</button>
          <button disabled={busy} className="btn-gold">{walkin ? tx('Check in & issue token') : appt ? tx('Save changes') : tx('Book appointment')}</button>
        </div>
      </form>
    </Modal>
  )
}
