import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, UserPlus, X } from 'lucide-react'
import { db, savePatient } from '../lib/db.js'
import { Avatar } from './ui.jsx'
import { useT } from '../lib/i18n.jsx'

export default function PatientPicker({ value, onChange, department, autoFocus }) {
  const { tx } = useT()
  const [q, setQ] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('Female')
  const [creating, setCreating] = useState(false)
  const patients = useLiveQuery(() => db.patients.toArray(), [])
  const selected = patients?.find(p => p.id === value)

  const results = useMemo(() => {
    if (!patients) return []
    const s = q.trim().toLowerCase()
    const list = s ? patients.filter(p => [p.name, p.phone, p.code].some(v => (v || '').toLowerCase().includes(s))) : [...patients].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    return list.slice(0, 6)
  }, [patients, q])

  const create = async () => {
    if (!q.trim()) return
    const id = await savePatient({ name: q.trim(), phone: phone.trim(), gender, department: department || 'Homoeopathy' })
    setCreating(false)
    setQ('')
    setPhone('')
    onChange(id)
  }

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gold-400/35 bg-gold-500/10 p-3">
        <Avatar name={selected.name} gender={selected.gender} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gold-200">{selected.name}</p>
          <p className="truncate text-xs text-gold-200/50">{selected.code}{selected.phone ? ` · ${selected.phone}` : ''}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg p-2 text-gold-300/70 hover:bg-night-600/60" aria-label={tx('Change patient')}><X size={16} /></button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-400/70" />
        <input className="input pl-10" placeholder={tx('Search patient by name, mobile or GMC ID…')} value={q} onChange={e => { setQ(e.target.value); setCreating(false) }} autoFocus={autoFocus} />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-gold-500/10 bg-night-950/40">
        {results.map(p => (
          <button type="button" key={p.id} onClick={() => onChange(p.id)} className="flex w-full items-center gap-3 border-b border-gold-500/5 px-3 py-2.5 text-left transition last:border-0 hover:bg-night-700/50">
            <Avatar name={p.name} gender={p.gender} size="h-9 w-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gold-200">{p.name}</p>
              <p className="truncate text-[11px] text-gold-200/45">{p.code}{p.phone ? ` · ${p.phone}` : ''}</p>
            </div>
          </button>
        ))}
        {results.length === 0 && <p className="px-3 py-4 text-center text-xs text-gold-200/40">No registered patient matches “{q}”.</p>}
      </div>
      {q.trim().length > 1 && !creating && (
        <button type="button" onClick={() => setCreating(true)} className="btn-ghost w-full"><UserPlus size={15} /> Register “{q.trim()}” as a new patient</button>
      )}
      {creating && (
        <div className="grid gap-2 rounded-xl border border-gold-500/20 bg-night-950/50 p-3 sm:grid-cols-[1fr_auto_auto]">
          <input className="input" inputMode="tel" placeholder={tx('Mobile number')} value={phone} onChange={e => setPhone(e.target.value)} />
          <select className="input" value={gender} onChange={e => setGender(e.target.value)}>
            <option value="Female">{tx('Female')}</option>
            <option value="Male">{tx('Male')}</option>
            <option value="Other">{tx('Other')}</option>
          </select>
          <button type="button" onClick={create} className="btn-gold">{tx('Register')}</button>
        </div>
      )}
    </div>
  )
}
