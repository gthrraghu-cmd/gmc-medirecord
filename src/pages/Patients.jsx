import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Search, UserPlus, Users, Phone, ChevronRight } from 'lucide-react'
import { db, DEPARTMENTS } from '../lib/db.js'
import { ageFrom, fmtDate } from '../lib/format.js'
import { Avatar, DeptChip, Empty, PageHeader } from '../components/ui.jsx'
import { useT } from '../lib/i18n.jsx'

export default function Patients({ go, onNewPatient }) {
  const { tx } = useT()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('All')
  const [sort, setSort] = useState('recent')
  const patients = useLiveQuery(() => db.patients.toArray(), [])
  const { t } = useT()

  const list = useMemo(() => {
    if (!patients) return []
    const s = q.trim().toLowerCase()
    let out = patients.filter(p => {
      if (dept !== 'All' && p.department !== dept) return false
      if (!s) return true
      return [p.name, p.phone, p.altPhone, p.code, p.city].some(v => (v || '').toLowerCase().includes(s))
    })
    if (sort === 'recent') out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    else if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name))
    else out.sort((a, b) => (b.code || '').localeCompare(a.code || ''))
    return out
  }, [patients, q, dept, sort])

  if (!patients) return null

  return (
    <div>
      <PageHeader eyebrow={t('patients.eyebrow', { n: patients.length })} title={t('patients.title')}>
        <button onClick={onNewPatient} className="btn-gold"><UserPlus size={16} /> {t('patients.register')}</button>
      </PageHeader>

      <div className="glass mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-400/70" />
          <input className="input pl-10" placeholder={t('patients.search')} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex min-w-0 gap-2 overflow-x-auto">
          {['All', ...DEPARTMENTS.map(d => d.key)].map(d => (
            <button key={d} onClick={() => setDept(d)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition ${dept === d ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
              {d === 'All' ? d : t(`dept.${d}`)}
            </button>
          ))}
        </div>
        <select className="input sm:w-40" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="recent">{tx('Recently active')}</option>
          <option value="name">{tx('Name A–Z')}</option>
          <option value="code">{tx('Newest ID')}</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="glass">
          <Empty
            icon={Users}
            title={patients.length ? tx('No matches') : tx('No patients yet')}
            text={patients.length ? tx('Try a different name, number or department.') : tx('Register your first patient to begin building records.')}
            action={!patients.length && <button onClick={onNewPatient} className="btn-gold"><UserPlus size={16} /> {tx('Register Patient')}</button>}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03 }}
              onClick={() => go({ name: 'patient', id: p.id })}
              className="glass group flex w-full min-w-0 items-center gap-3.5 p-4 text-left transition hover:-translate-y-0.5 hover:border-gold-500/35"
            >
              <Avatar name={p.name} gender={p.gender} size="h-12 w-12 text-base" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-gold-200">{p.name}</p>
                </div>
                <p className="mt-0.5 text-[11px] font-semibold tracking-wider text-gold-500/80">{p.code}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gold-200/45">
                  <span>{[ageFrom(p) && `${ageFrom(p)} y`, p.gender].filter(Boolean).join(' · ')}</span>
                  {p.phone && <span className="flex items-center gap-1"><Phone size={11} />{p.phone}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <DeptChip dept={p.department} />
                <span className="text-[10px] text-gold-200/35">{p.lastVisit ? fmtDate(p.lastVisit) : tx('New')}</span>
              </div>
              <ChevronRight size={16} className="text-gold-500/40 transition group-hover:translate-x-0.5 group-hover:text-gold-400" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
