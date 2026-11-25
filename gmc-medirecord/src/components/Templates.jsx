import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, BookMarked, Trash2, Pill, Star } from 'lucide-react'
import { db, deleteTemplate, saveTemplate } from '../lib/db.js'
import { useT } from '../lib/i18n.jsx'
import { DeptChip, Empty, Field, Modal, useToast } from './ui.jsx'

function rxSummary(t) {
  const rx = (t.rx || []).map(r => [r.medicine, r.potency].filter(Boolean).join(' ')).join(', ')
  return rx || [t.points, t.procedure].filter(Boolean).join(' · ') || t.advice || ''
}

export function TemplatePicker({ open, onClose, department, onApply }) {
  const { tx } = useT()
  const [q, setQ] = useState('')
  const list = useLiveQuery(() => db.templates.toArray(), [open]) || []

  useEffect(() => {
    if (open) setQ('')
  }, [open])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return list
      .filter(t => !s || [t.name, t.diagnosis, rxSummary(t)].some(v => (v || '').toLowerCase().includes(s)))
      .sort((a, b) => (b.department === department) - (a.department === department) || (b.uses || 0) - (a.uses || 0) || a.name.localeCompare(b.name))
  }, [list, q, department])

  return (
    <Modal open={open} onClose={onClose} title={tx('Prescription templates')} subtitle={tx('Tap a template to fill this consultation')}>
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-400/70" />
          <input className="input pl-10" value={q} onChange={e => setQ(e.target.value)} placeholder={tx('Search templates…')} autoFocus />
        </div>
        {shown.length === 0 ? (
          <Empty icon={BookMarked} title={tx('No templates yet')} text={tx('Fill a consultation and press “Save as template” to reuse it next time.')} />
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {shown.map(t => (
              <li key={t.id}>
                <button onClick={() => onApply(t)} className="flex w-full items-start gap-3 rounded-xl border border-gold-500/15 bg-night-950/40 p-3 text-left transition hover:border-gold-400/50 hover:bg-gold-500/10">
                  <Pill size={18} className="mt-0.5 shrink-0 text-gold-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gold-200">{t.name}</p>
                      <DeptChip dept={t.department} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gold-200/55">{rxSummary(t)}</p>
                    {t.followUpDays ? <p className="text-[11px] text-gold-200/40">{tx('Follow-up after')} {t.followUpDays} {tx('days')}</p> : null}
                  </div>
                  {t.uses ? <span className="flex shrink-0 items-center gap-1 text-[10px] text-gold-400"><Star size={10} className="fill-gold-400" />{t.uses}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

export function SaveTemplateModal({ open, onClose, visit }) {
  const { tx } = useT()
  const toast = useToast()
  const [name, setName] = useState('')

  useEffect(() => {
    if (open && visit) setName(visit.diagnosis?.trim() || visit.rx?.find(r => r.medicine)?.medicine || '')
  }, [open, visit])

  const save = async e => {
    e.preventDefault()
    if (!name.trim()) return toast(tx('Give the template a name'), 'err')
    const days = visit.followUp && visit.date ? Math.round((new Date(visit.followUp + 'T00:00:00') - new Date(visit.date + 'T00:00:00')) / 86400000) : 0
    await saveTemplate({
      name: name.trim(),
      department: visit.department,
      diagnosis: visit.diagnosis || '',
      rx: (visit.rx || []).filter(r => r.medicine?.trim()),
      advice: visit.advice || '',
      points: visit.points || '',
      sessionMins: visit.sessionMins || '',
      procedure: visit.procedure || '',
      area: visit.area || '',
      products: visit.products || '',
      followUpDays: days > 0 ? days : 0
    })
    toast(tx('Template saved'))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={tx('Save as template')} subtitle={tx('Remedies, advice, treatment and follow-up gap are saved — not the patient’s complaints or fee')}>
      <form onSubmit={save} className="space-y-5">
        <Field label={tx('Template name')}>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Migraine — acute" autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">{tx('Cancel')}</button>
          <button className="btn-gold"><BookMarked size={16} /> {tx('Save template')}</button>
        </div>
      </form>
    </Modal>
  )
}

export function TemplatesCard() {
  const { tx } = useT()
  const toast = useToast()
  const list = useLiveQuery(() => db.templates.toArray().then(a => a.sort((x, y) => (y.uses || 0) - (x.uses || 0) || x.name.localeCompare(y.name))), []) || []
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')

  const rename = async () => {
    if (!name.trim()) return
    await saveTemplate({ id: editing, name: name.trim() })
    setEditing(null)
    toast(tx('Template updated'))
  }

  return (
    <div className="glass p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10"><BookMarked size={18} className="text-gold-400" /></div>
        <div>
          <h3 className="font-display text-2xl font-semibold text-gold-200">{tx('Prescription templates')}</h3>
          <p className="text-xs text-gold-200/50">{tx('Create them from any consultation with “Save as template”')}</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="rounded-xl border border-gold-500/10 bg-night-950/40 p-4 text-center text-sm text-gold-200/45">{tx('No templates yet')}</p>
      ) : (
        <ul className="divide-y divide-gold-500/10">
          {list.map(t => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              {editing === t.id ? (
                <>
                  <input className="input flex-1 py-1.5" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && rename()} autoFocus />
                  <button onClick={rename} className="btn-gold px-3 py-1.5 text-xs">{tx('Save')}</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditing(t.id); setName(t.name) }} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-gold-200">{t.name}</p>
                    <p className="truncate text-xs text-gold-200/45">{rxSummary(t)}</p>
                  </button>
                  <DeptChip dept={t.department} />
                  <span className="w-10 text-right text-[11px] text-gold-200/40">{t.uses || 0}×</span>
                  <button onClick={async () => { await deleteTemplate(t.id); toast(tx('Template deleted')) }} className="rounded-lg p-1.5 text-gold-300/50 hover:bg-rose-500/10 hover:text-rose-300" aria-label={tx('Delete')}><Trash2 size={14} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
