import { useEffect, useState } from 'react'
import { Field, Modal, useToast } from '../components/ui.jsx'
import { DEPARTMENTS, savePatient } from '../lib/db.js'
import { useT } from '../lib/i18n.jsx'

const BLANK = {
  name: '', gender: 'Female', dob: '', age: '', phone: '', altPhone: '', email: '',
  address: '', city: '', bloodGroup: '', occupation: '', department: 'Homoeopathy',
  referredBy: '', allergies: '', history: '', notes: ''
}

export default function PatientForm({ open, onClose, patient, onSaved }) {
  const { tx } = useT()
  const [f, setF] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) setF(patient ? { ...BLANK, ...patient } : BLANK)
  }, [open, patient])

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!f.name.trim()) return toast(tx('Patient name is required'), 'err')
    if (f.phone && !/^[0-9+\-\s]{7,15}$/.test(f.phone)) return toast(tx('Check the phone number'), 'err')
    setBusy(true)
    const id = await savePatient({ ...f, name: f.name.trim() })
    setBusy(false)
    toast(patient ? tx('Patient updated') : tx('Patient registered'))
    onSaved?.(id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} wide title={patient ? tx('Edit Patient') : tx('Register Patient')} subtitle={patient ? patient.code : tx('A clinic ID is generated automatically')}>
      <form onSubmit={submit} className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-6">
          <Field label={tx('Full name *')} className="sm:col-span-4">
            <input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Lakshmi Narayanan" autoFocus />
          </Field>
          <Field label={tx('Gender')} className="sm:col-span-2">
            <select className="input" value={f.gender} onChange={set('gender')}>
              <option value="Female">{tx('Female')}</option>
              <option value="Male">{tx('Male')}</option>
              <option value="Other">{tx('Other')}</option>
            </select>
          </Field>
          <Field label={tx('Date of birth')} className="sm:col-span-2">
            <input type="date" className="input" value={f.dob} onChange={set('dob')} />
          </Field>
          <Field label={tx('Or age (years)')} className="sm:col-span-1">
            <input type="number" min="0" max="120" className="input" value={f.age} onChange={set('age')} disabled={!!f.dob} />
          </Field>
          <Field label={tx('Blood group')} className="sm:col-span-1">
            <select className="input" value={f.bloodGroup} onChange={set('bloodGroup')}>
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label={tx('Department')} className="sm:col-span-2">
            <select className="input" value={f.department} onChange={set('department')}>
              {DEPARTMENTS.map(d => <option key={d.key} value={d.key}>{tx(d.key)}</option>)}
            </select>
          </Field>
        </section>

        <div className="hairline" />

        <section className="grid gap-4 sm:grid-cols-6">
          <Field label={tx('Mobile')} className="sm:col-span-2">
            <input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="98xxxxxxxx" />
          </Field>
          <Field label={tx('Alternate mobile')} className="sm:col-span-2">
            <input className="input" inputMode="tel" value={f.altPhone} onChange={set('altPhone')} />
          </Field>
          <Field label={tx('Email')} className="sm:col-span-2">
            <input type="email" className="input" value={f.email} onChange={set('email')} />
          </Field>
          <Field label={tx('Address')} className="sm:col-span-4">
            <input className="input" value={f.address} onChange={set('address')} />
          </Field>
          <Field label={tx('City / Town')} className="sm:col-span-2">
            <input className="input" value={f.city} onChange={set('city')} />
          </Field>
          <Field label={tx('Occupation')} className="sm:col-span-3">
            <input className="input" value={f.occupation} onChange={set('occupation')} />
          </Field>
          <Field label={tx('Referred by')} className="sm:col-span-3">
            <input className="input" value={f.referredBy} onChange={set('referredBy')} />
          </Field>
        </section>

        <div className="hairline" />

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label={tx('Known allergies')}>
            <textarea rows="2" className="input" value={f.allergies} onChange={set('allergies')} />
          </Field>
          <Field label={tx('Past medical history')}>
            <textarea rows="2" className="input" value={f.history} onChange={set('history')} />
          </Field>
          <Field label={tx('Notes')} className="sm:col-span-2">
            <textarea rows="2" className="input" value={f.notes} onChange={set('notes')} />
          </Field>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">{tx('Cancel')}</button>
          <button disabled={busy} className="btn-gold">{patient ? tx('Save Changes') : tx('Register Patient')}</button>
        </div>
      </form>
    </Modal>
  )
}
