import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Package, BookMarked, BookmarkPlus } from 'lucide-react'
import { Field, Modal, useToast } from '../components/ui.jsx'
import RemedyInput from '../components/RemedyInput.jsx'
import { TemplatePicker, SaveTemplateModal } from '../components/Templates.jsx'
import { db, DEPARTMENTS, saveVisit, bumpTemplate } from '../lib/db.js'
import { addDaysISO, todayISO } from '../lib/format.js'
import { POTENCIES, DOSAGES, DURATIONS } from '../lib/remedies.js'
import { useT } from '../lib/i18n.jsx'

const RX = { medicine: '', potency: '', dosage: '', duration: '' }

const blank = patient => ({
  date: todayISO(), department: patient?.department || 'Homoeopathy',
  complaints: '', findings: '', diagnosis: '',
  bp: '', pulse: '', weight: '',
  rx: [{ ...RX }],
  points: '', sessionNo: '', sessionMins: '', packageId: 0,
  procedure: '', area: '', products: '',
  advice: '', fee: '', payMode: 'Cash', followUp: '', notes: ''
})

function Chips({ items, value, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(x => (
        <button type="button" key={x} onMouseDown={e => e.preventDefault()} onClick={() => onPick(x)} className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${value === x ? 'border-gold-400 bg-gold-500/20 text-gold-200' : 'border-gold-500/15 text-gold-200/55 hover:border-gold-500/40 hover:text-gold-200'}`}>
          {x}
        </button>
      ))}
    </div>
  )
}

export default function VisitForm({ open, onClose, patient, visit, preset }) {
  const { tx } = useT()
  const [f, setF] = useState(blank(patient))
  const [busy, setBusy] = useState(false)
  const [activeRow, setActiveRow] = useState(0)
  const [pickOpen, setPickOpen] = useState(false)
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      const base = visit ? { ...blank(patient), ...visit, rx: visit.rx?.length ? visit.rx : [{ ...RX }] } : blank(patient)
      if (preset?.medicine) {
        const rx = base.rx.filter(r => (r.medicine || '').trim())
        if (!rx.some(r => r.medicine.trim().toLowerCase() === preset.medicine.toLowerCase())) rx.push({ ...RX, medicine: preset.medicine })
        base.rx = rx.length ? rx : [{ ...RX }]
      }
      if (preset?.findings) {
        const cur = String(base.findings || '').trim()
        if (!cur.includes(preset.findings)) base.findings = cur ? `${cur}\n\n${preset.findings}` : preset.findings
      }
      setF(base)
      setActiveRow(0)
    }
  }, [open, visit, patient, preset])

  const used = useLiveQuery(async () => {
    const counts = {}
    await db.visits.each(v => (v.rx || []).forEach(r => {
      const n = (r.medicine || '').trim()
      if (n) counts[n] = (counts[n] || 0) + 1
    }))
    return counts
  }, [open]) || {}

  const packages = useLiveQuery(async () => {
    if (!patient?.id) return []
    const list = await db.packages.where('patientId').equals(patient.id).toArray()
    return list.filter(p => p.status === 'active' || p.id === visit?.packageId)
  }, [patient?.id, visit?.packageId, open]) || []

  const deptPackages = useMemo(() => packages.filter(p => p.department === f.department), [packages, f.department])

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }))
  const setRxVal = (i, k, val) => setF(s => ({ ...s, rx: s.rx.map((r, j) => (j === i ? { ...r, [k]: val } : r)) }))
  const addRx = () => {
    setF(s => ({ ...s, rx: [...s.rx, { ...RX }] }))
    setActiveRow(f.rx.length)
  }
  const delRx = i => setF(s => ({ ...s, rx: s.rx.length > 1 ? s.rx.filter((_, j) => j !== i) : [{ ...RX }] }))

  const choosePackage = async id => {
    const pid = Number(id) || 0
    if (!pid) return setF(s => ({ ...s, packageId: 0 }))
    const pkg = packages.find(p => p.id === pid)
    let n = await db.visits.where('packageId').equals(pid).count()
    if (visit?.packageId === pid) n -= 1
    setF(s => ({ ...s, packageId: pid, sessionNo: `${n + 1} of ${pkg.totalSessions}`, procedure: s.department === 'Cosmetology' && !s.procedure ? pkg.name : s.procedure }))
  }

  const applyTemplate = async tpl => {
    setF(s => {
      const keep = s.rx.filter(r => r.medicine.trim())
      const rx = tpl.rx?.length ? [...keep, ...tpl.rx.map(r => ({ ...RX, ...r }))] : s.rx
      return {
        ...s,
        department: tpl.department || s.department,
        diagnosis: s.diagnosis.trim() ? s.diagnosis : tpl.diagnosis || '',
        rx: rx.length ? rx : [{ ...RX }],
        advice: s.advice.trim() ? s.advice : tpl.advice || '',
        points: s.points.trim() ? s.points : tpl.points || '',
        sessionMins: s.sessionMins || tpl.sessionMins || '',
        procedure: s.procedure.trim() ? s.procedure : tpl.procedure || '',
        area: s.area.trim() ? s.area : tpl.area || '',
        products: s.products.trim() ? s.products : tpl.products || '',
        followUp: tpl.followUpDays ? addDaysISO(s.date || todayISO(), tpl.followUpDays) : s.followUp
      }
    })
    await bumpTemplate(tpl.id)
    setPickOpen(false)
    toast(`${tx('Template applied')} · ${tpl.name}`)
  }

  const submit = async e => {
    e.preventDefault()
    if (!f.complaints.trim() && !f.diagnosis.trim()) return toast(tx('Add complaints or a diagnosis'), 'err')
    setBusy(true)
    await saveVisit({ ...f, patientId: patient.id, packageId: deptPackages.some(p => p.id === f.packageId) ? f.packageId : 0, rx: f.rx.filter(r => r.medicine.trim()) })
    setBusy(false)
    toast(visit ? tx('Consultation updated') : tx('Consultation saved'))
    onClose()
  }

  const dept = f.department
  const row = f.rx[activeRow]

  return (
    <Modal open={open} onClose={onClose} wide title={visit ? tx('Edit Consultation') : tx('New Consultation')} subtitle={patient ? `${patient.name} · ${patient.code}` : ''}>
      <form onSubmit={submit} className="space-y-6">
        <button type="button" onClick={() => setPickOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-gold-400/40 bg-gold-500/5 px-4 py-3 text-left transition hover:border-gold-400/70 hover:bg-gold-500/10">
          <BookMarked size={18} className="text-gold-400" />
          <span className="flex-1 text-sm font-semibold text-gold-200">{tx('Use a template')}</span>
          <span className="text-xs text-gold-200/45">{tx('Fills remedies, advice and follow-up')}</span>
        </button>
        <section className="grid gap-4 sm:grid-cols-6">
          <Field label={tx('Date')} className="sm:col-span-2">
            <input type="date" className="input" value={f.date} onChange={set('date')} />
          </Field>
          <div className="sm:col-span-4">
            <span className="label">{tx('Department')}</span>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(d => (
                <button type="button" key={d.key} onClick={() => setF(s => ({ ...s, department: d.key }))} className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${dept === d.key ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
                  {tx(d.key)}
                </button>
              ))}
            </div>
          </div>
          <Field label="BP" className="sm:col-span-2">
            <input className="input" value={f.bp} onChange={set('bp')} placeholder="120/80" />
          </Field>
          <Field label={tx('Pulse')} className="sm:col-span-2">
            <input className="input" value={f.pulse} onChange={set('pulse')} placeholder="72" />
          </Field>
          <Field label={tx('Weight (kg)')} className="sm:col-span-2">
            <input className="input" value={f.weight} onChange={set('weight')} />
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label={tx('Chief complaints *')} className="sm:col-span-2">
            <textarea rows="2" className="input" value={f.complaints} onChange={set('complaints')} placeholder={tx('Symptoms, duration, modalities…')} />
          </Field>
          <Field label={tx('Findings')}>
            <textarea rows="2" className="input" value={f.findings} onChange={set('findings')} />
          </Field>
          <Field label={tx('Diagnosis')}>
            <textarea rows="2" className="input" value={f.diagnosis} onChange={set('diagnosis')} />
          </Field>
        </section>

        {(dept === 'Homoeopathy' || dept === 'General') && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">{tx('Prescription')}</span>
              <button type="button" onClick={addRx} className="btn-ghost px-3 py-1.5 text-xs"><Plus size={14} /> {tx('Add remedy')}</button>
            </div>
            <div className="space-y-2">
              {f.rx.map((r, i) => (
                <div key={i} className={`grid grid-cols-12 gap-2 rounded-xl border p-2 transition ${activeRow === i ? 'border-gold-400/40 bg-night-950/60' : 'border-gold-500/10 bg-night-950/40'}`}>
                  <RemedyInput className="col-span-12 sm:col-span-4" value={r.medicine} used={used} onChange={v => setRxVal(i, 'medicine', v)} onFocus={() => setActiveRow(i)} placeholder={dept === 'Homoeopathy' ? tx('Remedy') : tx('Medicine')} />
                  <input className="input col-span-4 sm:col-span-2" placeholder={dept === 'Homoeopathy' ? '30C' : tx('Strength')} value={r.potency} onFocus={() => setActiveRow(i)} onChange={e => setRxVal(i, 'potency', e.target.value)} />
                  <input className="input col-span-4 sm:col-span-3" placeholder="4 pills TDS" value={r.dosage} onFocus={() => setActiveRow(i)} onChange={e => setRxVal(i, 'dosage', e.target.value)} />
                  <input className="input col-span-3 sm:col-span-2" placeholder="7 days" value={r.duration} onFocus={() => setActiveRow(i)} onChange={e => setRxVal(i, 'duration', e.target.value)} />
                  <button type="button" onClick={() => delRx(i)} className="col-span-1 grid place-items-center rounded-lg text-gold-200/40 hover:text-rose-300" aria-label={tx('Remove')}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            {row && (
              <div className="mt-3 space-y-2 rounded-xl border border-gold-500/10 bg-night-950/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold-400/70">{tx('Quick pick')} · {tx('remedy')} {activeRow + 1}</p>
                <div className="grid gap-2 sm:grid-cols-[70px_1fr] sm:items-center">
                  <span className="text-[11px] text-gold-200/45">{tx('Potency')}</span>
                  <Chips items={POTENCIES} value={row.potency} onPick={x => setRxVal(activeRow, 'potency', x)} />
                  <span className="text-[11px] text-gold-200/45">{tx('Dosage')}</span>
                  <Chips items={DOSAGES} value={row.dosage} onPick={x => setRxVal(activeRow, 'dosage', x)} />
                  <span className="text-[11px] text-gold-200/45">{tx('Duration')}</span>
                  <Chips items={DURATIONS} value={row.duration} onPick={x => setRxVal(activeRow, 'duration', x)} />
                </div>
              </div>
            )}
          </section>
        )}

        {(dept === 'Acupuncture' || dept === 'Cosmetology') && deptPackages.length > 0 && (
          <section className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-3">
            <span className="label flex items-center gap-1.5"><Package size={13} /> {tx('Count this visit against a package')}</span>
            <select className="input" value={deptPackages.some(p => p.id === f.packageId) ? f.packageId : 0} onChange={e => choosePackage(e.target.value)}>
              <option value={0}>{tx('No package — single visit')}</option>
              {deptPackages.map(p => (
                <option key={p.id} value={p.id}>{p.name} · {p.used || 0} of {p.totalSessions} used</option>
              ))}
            </select>
          </section>
        )}

        {dept === 'Acupuncture' && (
          <section className="grid gap-4 sm:grid-cols-6">
            <Field label={tx('Points used')} className="sm:col-span-6">
              <textarea rows="2" className="input" value={f.points} onChange={set('points')} placeholder="LI4, ST36, SP6…" />
            </Field>
            <Field label={tx('Session no.')} className="sm:col-span-3">
              <input className="input" value={f.sessionNo} onChange={set('sessionNo')} placeholder="3 of 10" />
            </Field>
            <Field label={tx('Duration (mins)')} className="sm:col-span-3">
              <input className="input" value={f.sessionMins} onChange={set('sessionMins')} placeholder="30" />
            </Field>
          </section>
        )}

        {dept === 'Cosmetology' && (
          <section className="grid gap-4 sm:grid-cols-6">
            <Field label={tx('Procedure')} className="sm:col-span-3">
              <input className="input" value={f.procedure} onChange={set('procedure')} placeholder="Chemical peel, PRP…" />
            </Field>
            <Field label={tx('Treated area')} className="sm:col-span-3">
              <input className="input" value={f.area} onChange={set('area')} />
            </Field>
            {f.packageId > 0 && (
              <Field label={tx('Session no.')} className="sm:col-span-6">
                <input className="input" value={f.sessionNo} onChange={set('sessionNo')} />
              </Field>
            )}
            <Field label={tx('Products used')} className="sm:col-span-6">
              <textarea rows="2" className="input" value={f.products} onChange={set('products')} />
            </Field>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-6">
          <Field label={tx('Advice')} className="sm:col-span-6">
            <textarea rows="2" className="input" value={f.advice} onChange={set('advice')} placeholder={tx('Diet, lifestyle, precautions…')} />
          </Field>
          <Field label={tx('Fee (₹)')} className="sm:col-span-2">
            <input type="number" min="0" className="input" value={f.fee} onChange={set('fee')} placeholder={f.packageId ? tx('Covered by package') : ''} />
          </Field>
          <Field label={tx('Payment')} className="sm:col-span-2">
            <select className="input" value={f.payMode} onChange={set('payMode')}>
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option value="Pending">{tx('Pending')}</option>
            </select>
          </Field>
          <Field label={tx('Next follow-up')} className="sm:col-span-2">
            <input type="date" className="input" value={f.followUp} onChange={set('followUp')} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-6">
            {[7, 15, 30].map(d => (
              <button type="button" key={d} onClick={() => setF(s => ({ ...s, followUp: addDaysISO(s.date || todayISO(), d) }))} className="chip border-gold-500/25 text-gold-300 hover:bg-gold-500/10">
                +{d} {tx('days')}
              </button>
            ))}
            {f.followUp && (
              <button type="button" onClick={() => setF(s => ({ ...s, followUp: '' }))} className="chip border-gold-500/10 text-gold-200/40">{tx('Clear')}</button>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button type="button" onClick={() => setSaveTplOpen(true)} className="btn-ghost px-3 text-xs"><BookmarkPlus size={15} /> {tx('Save as template')}</button>
          <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">{tx('Cancel')}</button>
          <button disabled={busy} className="btn-gold">{visit ? tx('Save Changes') : tx('Save Consultation')}</button>
          </div>
        </div>
      </form>
      <TemplatePicker open={pickOpen} onClose={() => setPickOpen(false)} department={f.department} onApply={applyTemplate} />
      <SaveTemplateModal open={saveTplOpen} onClose={() => setSaveTplOpen(false)} visit={f} />
    </Modal>
  )
}
