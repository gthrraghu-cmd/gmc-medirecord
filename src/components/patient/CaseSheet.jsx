import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Brain, Thermometer, Stethoscope, History, Sparkles, Printer } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db.js'
import { CaseSheetDoc } from '../PrintSheets.jsx'
import DocPreview from '../DocPreview.jsx'
import { getCase, saveCase } from '../../lib/db.js'
import { CRAVINGS, MIASMS, MIND_RUBRICS, THERMALS } from '../../lib/remedies.js'
import { Field, useToast } from '../ui.jsx'
import RemedyInput from '../RemedyInput.jsx'
import { useT } from '../../lib/i18n.jsx'

const BLANK = {
  location: '', sensation: '', modalities: '', concomitants: '',
  mind: [], mindNotes: '',
  thermal: '', appetite: '', thirst: '', cravings: [], aversions: '', stool: '', urine: '', perspiration: '', sleep: '', dreams: '',
  menses: '', pastHistory: '', familyHistory: '',
  miasm: '', constitutional: '', totality: ''
}

function Card({ icon: Icon, title, children, i }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass p-4 sm:p-5">
      <h4 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-gold-200">
        <Icon size={18} className="text-gold-400" /> {title}
      </h4>
      {children}
    </motion.section>
  )
}

function Toggle({ items, value, onChange, multi }) {
  const isOn = x => (multi ? (value || []).includes(x) : value === x)
  const flip = x => {
    if (multi) onChange(isOn(x) ? value.filter(v => v !== x) : [...(value || []), x])
    else onChange(isOn(x) ? '' : x)
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(x => (
        <button type="button" key={x} onClick={() => flip(x)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${isOn(x) ? 'border-gold-400 bg-gold-500/20 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/40'}`}>
          {x}
        </button>
      ))}
    </div>
  )
}

export default function CaseSheet({ patient, profile }) {
  const { tx } = useT()
  const toast = useToast()
  const [f, setF] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const visits = useLiveQuery(() => db.visits.where('patientId').equals(patient.id).toArray().then(a => a.sort((x, y) => x.date.localeCompare(y.date))), [patient.id]) || []

  useEffect(() => {
    getCase(patient.id).then(c => {
      setF({ ...BLANK, ...(c || {}) })
      setUpdatedAt(c?.updatedAt || null)
      setDirty(false)
    })
  }, [patient.id])

  if (!f) return null

  const put = (k, v) => {
    setF(s => ({ ...s, [k]: v }))
    setDirty(true)
  }
  const set = k => e => put(k, e.target.value)

  const save = async () => {
    await saveCase(patient.id, f)
    setUpdatedAt(Date.now())
    setDirty(false)
    toast(tx('Case sheet saved'))
  }

  const text = (k, label, ph, rows = 2, cls = '') => (
    <Field label={tx(label)} className={cls}>
      <textarea rows={rows} className="input" value={f[k]} onChange={set(k)} placeholder={tx(ph)} />
    </Field>
  )

  return (
    <div className="space-y-4">
      <div className="glass sticky top-[68px] z-10 flex items-center justify-between gap-3 px-4 py-3 lg:top-3">
        <div>
          <p className="font-display text-xl font-semibold text-gold-200">{tx('Homoeopathic case sheet')}</p>
          <p className="text-[11px] text-gold-200/45">{updatedAt ? `${tx('Last saved')} ${new Date(updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}` : tx('Not recorded yet')}{dirty ? ` · ${tx('unsaved changes')}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPrintOpen(true)} className="btn-ghost" title={tx('Print case sheet')}><Printer size={16} /><span className="hidden sm:inline">{tx('Print case sheet')}</span></button>
          <button onClick={save} disabled={!dirty} className="btn-gold"><Save size={16} /> {tx('Save')}</button>
        </div>
      </div>

      <DocPreview open={printOpen} onClose={() => setPrintOpen(false)} title={tx('Print case sheet')} subtitle={`${patient.name} · ${patient.code}`} sheet={<CaseSheetDoc profile={profile} patient={patient} sheet={f} visits={visits} />} />

      <Card i={0} icon={Stethoscope} title={tx('Presenting complaint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          {text('location', 'Location', 'Where exactly, extensions, side')}
          {text('sensation', 'Sensation', 'Burning, stitching, throbbing…')}
          {text('modalities', 'Modalities', 'Better from… / Worse from…')}
          {text('concomitants', 'Concomitants', 'Symptoms appearing alongside')}
        </div>
      </Card>

      <Card i={1} icon={Brain} title={tx('Mind')}>
        <Toggle items={MIND_RUBRICS} value={f.mind} onChange={v => put('mind', v)} multi />
        <div className="mt-4">{text('mindNotes', 'Mental state in the patient’s words', 'Fears, emotions, reactions, temperament…', 3)}</div>
      </Card>

      <Card i={2} icon={Thermometer} title={tx('Physical generals')}>
        <div className="space-y-4">
          <div>
            <span className="label">{tx('Thermal state')}</span>
            <Toggle items={THERMALS} value={f.thermal} onChange={v => put('thermal', v)} />
          </div>
          <div>
            <span className="label">{tx('Cravings')}</span>
            <Toggle items={CRAVINGS} value={f.cravings} onChange={v => put('cravings', v)} multi />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {text('appetite', 'Appetite', '', 1)}
            {text('thirst', 'Thirst', 'Large / small quantities, frequency', 1)}
            {text('aversions', 'Aversions', '', 1)}
            {text('stool', 'Stool', '', 1)}
            {text('urine', 'Urine', '', 1)}
            {text('perspiration', 'Perspiration', 'Parts, odour, staining', 1)}
            {text('sleep', 'Sleep', 'Position, quality', 1)}
            {text('dreams', 'Dreams', '', 1)}
            {patient.gender === 'Female' && text('menses', 'Menstrual history', 'Cycle, flow, pain, concomitants', 1)}
          </div>
        </div>
      </Card>

      <Card i={3} icon={History} title={tx('History')}>
        <div className="grid gap-4 sm:grid-cols-2">
          {text('pastHistory', 'Past history', 'Illnesses, surgeries, vaccinations')}
          {text('familyHistory', 'Family history', 'Diabetes, hypertension, TB, cancer…')}
        </div>
      </Card>

      <Card i={4} icon={Sparkles} title={tx('Analysis')}>
        <div className="space-y-4">
          <div>
            <span className="label">{tx('Miasm')}</span>
            <Toggle items={MIASMS} value={f.miasm} onChange={v => put('miasm', v)} />
          </div>
          <div>
            <span className="label">{tx('Constitutional remedy')}</span>
            <RemedyInput value={f.constitutional} onChange={v => put('constitutional', v)} placeholder={tx('Search remedy')} />
          </div>
          {text('totality', 'Totality & repertorisation notes', 'Characteristic symptoms, rubrics, differential remedies…', 4)}
        </div>
      </Card>
    </div>
  )
}
