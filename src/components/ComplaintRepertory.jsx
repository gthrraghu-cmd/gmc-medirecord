import { useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, Loader2, Info, Plus } from 'lucide-react'
import { loadRepertory, repertorise, sortResults } from '../lib/repertory.js'
import { RemedyDialog, rubricLabel } from '../pages/Repertory.jsx'

function depth(path) {
  return path.split(', ').length
}

function candidatesFor(rep, line) {
  const { items } = rep.search(line, -1, 400)
  return items
    .filter(r => r.count > 0)
    .sort((a, b) => depth(a.path) - depth(b.path) || b.count - a.count || a.path.length - b.path.length)
    .slice(0, 8)
}

export default function ComplaintRepertory({ text, onUse }) {
  const [rep, setRep] = useState(null)
  const [error, setError] = useState('')
  const [debounced, setDebounced] = useState(text)
  const [choice, setChoice] = useState({})
  const [skip, setSkip] = useState({})
  const [why, setWhy] = useState(null)

  const lines = useMemo(() => String(debounced || '').split(/\n|;/).map(l => l.trim()).filter(l => l.length >= 3), [debounced])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 400)
    return () => clearTimeout(t)
  }, [text])

  useEffect(() => {
    if (!lines.length || rep || error) return
    loadRepertory().then(setRep).catch(err => setError(err.message))
  }, [lines.length, rep, error])

  const matches = useMemo(() => {
    if (!rep) return []
    return lines.map(line => {
      const options = candidatesFor(rep, line)
      const picked = options.find(o => o.id === choice[line]) || options[0] || null
      return { line, options, picked, off: !!skip[line] }
    })
  }, [rep, lines, choice, skip])

  const rubrics = useMemo(() => matches.filter(m => m.picked && !m.off).map(m => ({ id: m.picked.id, path: m.picked.path, intensity: 1 })), [matches])
  const results = useMemo(() => (rep && rubrics.length ? sortResults(repertorise(rep, rubrics), 'coverage') : []), [rep, rubrics])

  if (!lines.length) return null

  return (
    <div className="mt-2 rounded-xl border border-gold-500/20 bg-night-950/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold-400/80"><BookOpenCheck size={12} /> Repertory suggestions</p>
      {error ? (
        <p className="text-xs text-rose-200/80">{error}</p>
      ) : !rep ? (
        <p className="flex items-center gap-2 text-xs text-gold-200/50"><Loader2 size={13} className="animate-spin" /> Opening the repertory…</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {matches.map(m => (
              <li key={m.line} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <label className="flex min-w-0 items-center gap-2 text-xs text-gold-200/60 sm:w-40 sm:shrink-0">
                  <input type="checkbox" checked={!m.off && !!m.picked} disabled={!m.picked} onChange={() => setSkip(s => ({ ...s, [m.line]: !s[m.line] }))} className="accent-[#d4a537]" />
                  <span className="truncate uppercase">{m.line}</span>
                </label>
                {m.picked ? (
                  <select className={`input py-1.5 text-xs ${m.off ? 'opacity-40' : ''}`} value={m.picked.id} onChange={e => setChoice(c => ({ ...c, [m.line]: Number(e.target.value) }))}>
                    {m.options.map(o => <option key={o.id} value={o.id}>{rubricLabel(o.path)} · {o.count}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-gold-200/35">No rubric found — try other words (e.g. head pain, sleepless)</span>
                )}
              </li>
            ))}
          </ul>
          {results.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] text-gold-200/50"><span className="font-semibold text-gold-200/80">{results.length} remedies</span> · best first · tap a remedy to add it to the prescription and the rubrics to findings · ⓘ shows why</p>
              <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {results.map((r, i) => (
                  <span key={r.idx} className={`flex items-center overflow-hidden rounded-lg border text-xs ${i === 0 ? 'border-gold-400/60 bg-gold-500/15' : 'border-gold-500/20'}`}>
                    <button type="button" onClick={() => onUse(r, rubrics)} className="flex items-center gap-1 px-2 py-1 text-gold-200 hover:bg-gold-500/15" title={`Add ${r.name}`}>
                      <Plus size={12} /> <span className={r.grades.every(g => g === 3) || i < 3 ? 'font-bold' : ''}>{r.abbrev}</span> <span className="text-gold-200/50">{r.count}/{rubrics.length} · {r.score}</span>
                    </button>
                    <button type="button" onClick={() => setWhy(r)} className="border-l border-gold-500/20 px-1.5 py-1 text-gold-400/70 hover:bg-gold-500/15 hover:text-gold-200" aria-label={`Why ${r.abbrev}`}><Info size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <RemedyDialog remedy={why} rubrics={rubrics} onClose={() => setWhy(null)} />
    </div>
  )
}
