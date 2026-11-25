import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenCheck, ChevronRight, ChevronDown, ListPlus, Loader2, Plus, Save, Search, Trash2, X, ArrowLeft, Check, ExternalLink, Filter, Microscope, Pill, Info } from 'lucide-react'
import { PageHeader, Field, useToast, Empty, Modal } from '../components/ui.jsx'
import PatientPicker from '../components/PatientPicker.jsx'
import { db, saveRepertorisation, deleteRepertorisation } from '../lib/db.js'
import { todayISO } from '../lib/format.js'
import { loadRepertory, repertorise, sortResults } from '../lib/repertory.js'
import { BarList } from '../components/charts.jsx'

const work = { picked: [], patientId: null, note: '', editingId: null, visit: null }

export function oorepLink(text) {
  const symptom = String(text || '').replace(/[,;:()]/g, ' ').replace(/\s+/g, ' ').trim()
  return `https://www.oorep.com/show?repertory=kent&symptom=${encodeURIComponent(symptom)}&page=1&remedyString=&minWeight=0`
}

const GRADE_TEXT = {
  3: 'font-bold uppercase text-gold-200',
  2: 'font-semibold italic text-gold-300',
  1: 'text-gold-200/60'
}

function Remedies({ list }) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[13px] leading-relaxed">
      {list.map(r => (
        <span key={r.idx} title={`${r.name} · grade ${r.grade}`} className={GRADE_TEXT[r.grade] || GRADE_TEXT[1]}>{r.abbrev}</span>
      ))}
    </div>
  )
}

function RubricRow({ r, added, onOpen, onAdd }) {
  return (
    <div className="group flex items-center gap-2 border-b border-gold-500/10 px-3 py-2.5 last:border-0 hover:bg-gold-500/5">
      <button onClick={() => onOpen(r.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm text-gold-200">
          <span className="text-gold-400/70">{r.chapter}</span>
          {r.path.length > r.chapter.length ? <span>{r.path.slice(r.chapter.length)}</span> : null}
        </p>
        <p className="text-[11px] text-gold-200/40">
          {r.count} {r.count === 1 ? 'remedy' : 'remedies'}{r.children ? ` · ${r.children} sub-rubrics` : ''}
        </p>
      </button>
      <button onClick={() => onAdd(r)} disabled={added} className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${added ? 'border-emerald-400/30 text-emerald-300' : 'border-gold-500/25 text-gold-300 hover:bg-gold-500/15'}`} title={added ? 'Already in the case' : 'Add to case'}>
        {added ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </div>
  )
}

export function rubricLabel(path) {
  return String(path || '').split(', ').join(' - ')
}

export function RemedyDialog({ remedy, rubrics, onClose, action }) {
  const open = !!remedy
  const covered = open ? rubrics.map((p, i) => ({ p, i, g: remedy.grades?.[i] || 0 })).filter(x => x.g) : []
  const missing = open ? rubrics.map((p, i) => ({ p, i, g: remedy.grades?.[i] || 0 })).filter(x => !x.g) : []
  return (
    <Modal open={open} onClose={onClose} title={open ? `${remedy.abbrev} · ${remedy.name}` : ''} subtitle={open ? `Chosen for ${covered.length} of ${rubrics.length} rubrics · score ${remedy.score}` : ''}>
      {open && (
        <div className="space-y-4">
          <div>
            <p className="label">Found in these rubrics</p>
            <ul className="space-y-1.5">
              {covered.map(({ p, i, g }) => (
                <li key={i} className="flex items-start gap-2 text-[14px] leading-snug">
                  <span className="w-5 shrink-0 text-right text-gold-200/40">{i + 1}.</span>
                  <span className="min-w-0 flex-1 font-medium text-gold-100">{rubricLabel(p.path)}</span>
                  <span className={`shrink-0 rounded-md px-1.5 text-[11px] font-bold ${g === 3 ? 'gold-fill text-ink' : g === 2 ? 'border border-gold-400/50 text-gold-200' : 'border border-gold-500/25 text-gold-200/70'}`}>grade {g}</span>
                </li>
              ))}
            </ul>
          </div>
          {missing.length > 0 && (
            <div>
              <p className="label text-rose-200/80">Not in these rubrics</p>
              <ul className="space-y-1.5">
                {missing.map(({ p, i }) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-rose-200/70">
                    <span className="w-5 shrink-0 text-right text-rose-200/40">{i + 1}.</span>
                    <span className="min-w-0 flex-1">{rubricLabel(p.path)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gold-500/10 pt-4">
            {action}
            <button onClick={onClose} className="btn-ghost">OK</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Repertory({ go, patientId, visit, load, nonce }) {
  const toast = useToast()
  const [rep, setRep] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [chapter, setChapter] = useState(-1)
  const [open, setOpen] = useState(null)
  const [picked, setPicked] = useState(work.picked)
  const [pid, setPid] = useState(patientId || work.patientId)
  const [note, setNote] = useState(work.note)
  const [editingId, setEditingId] = useState(work.editingId)
  const [forVisit, setForVisit] = useState(visit || work.visit)
  const [sortBy, setSortBy] = useState('coverage')
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState(null)
  const [chosen, setChosen] = useState(null)
  const patient = useLiveQuery(() => (pid ? db.patients.get(pid) : undefined), [pid])

  useEffect(() => {
    loadRepertory().then(setRep).catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (patientId) setPid(patientId)
    if (visit) setForVisit(visit)
    if (load) {
      setForVisit(load.visitId ? { id: load.visitId, date: load.visitDate } : null)
      setPicked(load.rubrics.map(r => ({ id: r.id, path: r.path, intensity: r.intensity || 1, elim: !!r.elim })))
      if (load.sortBy) setSortBy(load.sortBy)
      setNote(load.note || '')
      setEditingId(load.id)
    }
  }, [patientId, visit, load, nonce])

  useEffect(() => {
    if (!rep || !load) return
    setPicked(list => list.map(p => (rep.rubric(p.id)?.path === p.path ? p : { ...p, id: rep.findByPath(p.path) })).filter(p => p.id >= 0))
  }, [rep, load, nonce])

  useEffect(() => {
    work.picked = picked
    work.patientId = pid
    work.note = note
    work.editingId = editingId
    work.visit = forVisit
  }, [picked, pid, note, editingId, forVisit])

  const results = useMemo(() => (rep && q.trim().length >= 2 ? rep.search(q, chapter) : null), [rep, q, chapter])
  const browse = useMemo(() => {
    if (!rep || results) return null
    if (chapter >= 0) return rep.children(chapter)
    return rep.chapters
  }, [rep, results, chapter])
  const detail = useMemo(() => (rep && open !== null ? { r: rep.rubric(open), trail: rep.trail(open), remedies: rep.remedies(open), kids: rep.children(open) } : null), [rep, open])
  const analysis = useMemo(() => {
    if (!rep || !picked.length) return { all: [], kept: [], elimCols: [] }
    const elimCols = picked.map((p, i) => (p.elim ? i : -1)).filter(i => i >= 0)
    const all = sortResults(repertorise(rep, picked), sortBy)
    const kept = elimCols.length ? all.filter(r => elimCols.every(c => r.grades[c] > 0)) : all
    return { all, kept, elimCols }
  }, [rep, picked, sortBy])
  const ranked = analysis.kept.slice(0, 25)
  const selected = useMemo(() => analysis.kept.find(r => r.idx === chosen) || analysis.kept[0] || null, [analysis, chosen])
  const focused = useMemo(() => (focus === null ? null : analysis.all.find(r => r.idx === focus) || null), [analysis, focus])
  const pickedIds = useMemo(() => new Set(picked.map(p => p.id)), [picked])

  const add = r => {
    if (pickedIds.has(r.id)) return
    setPicked(list => [...list, { id: r.id, path: r.path, intensity: 1 }])
  }
  const toggleElim = id => setPicked(list => list.map(p => (p.id === id ? { ...p, elim: !p.elim } : p)))
  const setIntensity = (id, intensity) => setPicked(list => list.map(p => (p.id === id ? { ...p, intensity } : p)))
  const remove = id => setPicked(list => list.filter(p => p.id !== id))
  const clear = () => {
    setPicked([])
    setNote('')
    setEditingId(null)
    setForVisit(null)
    setFocus(null)
    setChosen(null)
  }

  const save = async prescribed => {
    if (!pid) return toast('Choose the patient below first', 'err')
    if (!picked.length) return toast('Add at least one rubric', 'err')
    setBusy(true)
    try {
      const all = analysis.kept
      await saveRepertorisation(pid, {
        id: editingId || undefined,
        date: forVisit?.date || todayISO(),
        visitId: forVisit?.id || null,
        visitDate: forVisit?.date || null,
        source: rep.info.name,
        note: note.trim(),
        rubrics: picked.map(p => ({ id: p.id, path: p.path, intensity: p.intensity, elim: !!p.elim })),
        top: all.slice(0, 10).map(r => ({ abbrev: r.abbrev, name: r.name, score: r.score, count: r.count })),
        results: all.slice(0, 30).map(r => ({ abbrev: r.abbrev, name: r.name, score: r.score, count: r.count, grades: r.grades })),
        sortBy,
        prescribed: prescribed ? { abbrev: prescribed.abbrev, name: prescribed.name } : null
      })
      const visitId = forVisit?.id || null
      const rubricLines = picked.map((p, i) => `${i + 1}. ${rubricLabel(p.path)}${prescribed && prescribed.grades ? (prescribed.grades[i] ? ` (grade ${prescribed.grades[i]})` : ' (not covered)') : ''}`)
      const findings = ['Repertorisation rubrics:', ...rubricLines].join('\n')
      clear()
      if (prescribed) {
        toast(`Repertorisation saved · prescribing ${prescribed.name}`)
        go({ name: 'patient', id: pid, prescribe: { medicine: prescribed.name, visitId, findings }, nonce: Date.now() })
      } else toast(`Saved to ${patient?.name || 'patient'}'s case`)
    } catch (err) {
      toast(err.message || 'Could not save', 'err')
    }
    setBusy(false)
  }

  if (error) {
    return (
      <div>
        <PageHeader eyebrow="Kent-style repertory" title="Repertory" />
        <div className="glass"><Empty icon={BookOpenCheck} title="Repertory not available" text={error} /></div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader eyebrow={rep ? `${rep.info.name} · ${rep.info.rubrics.toLocaleString('en-IN')} rubrics · ${rep.info.remedies} remedies` : 'Kent-style repertory'} title="Repertory">
        {patient && (
          <button onClick={() => go({ name: 'patient', id: patient.id })} className="btn-ghost"><ArrowLeft size={16} /> {patient.name}</button>
        )}
      </PageHeader>

      {!rep ? (
        <div className="glass flex items-center justify-center gap-3 p-10 text-sm text-gold-200/60"><Loader2 size={18} className="animate-spin text-gold-400" /> Opening the repertory…</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="min-w-0 space-y-4 lg:col-span-3">
            <div className="glass flex flex-col gap-3 p-3 sm:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-400/70" />
                <input className="input pl-10" placeholder="Search rubrics — e.g. fear dark, headache sun, thirst large, desire salt" value={q} onChange={e => { setQ(e.target.value); setOpen(null) }} autoFocus />
              </div>
              {q.trim().length >= 2 && (
                <a href={oorepLink(q)} target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0" title="Search the same words in Kent's Repertory on oorep.com (needs internet)"><ExternalLink size={15} /> Kent on OOREP</a>
              )}
              <select className="input sm:w-52" value={chapter} onChange={e => { setChapter(Number(e.target.value)); setOpen(null) }}>
                <option value={-1}>All chapters</option>
                {rep.chapters.map(c => <option key={c.id} value={c.id}>{c.leaf}</option>)}
              </select>
            </div>

            {detail ? (
              <div className="glass p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-gold-200/50">
                  <button onClick={() => setOpen(null)} className="rounded-md px-1.5 py-0.5 hover:bg-gold-500/10 hover:text-gold-200"><ArrowLeft size={13} className="inline" /> Back</button>
                  {detail.trail.map((t, i) => (
                    <span key={t.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight size={12} />}
                      <button onClick={() => setOpen(t.id)} className={`rounded-md px-1.5 py-0.5 hover:bg-gold-500/10 hover:text-gold-200 ${t.id === open ? 'text-gold-200' : ''}`}>{t.leaf}</button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-display text-2xl font-semibold text-gold-200">{detail.r.path}</h3>
                  <div className="flex flex-wrap gap-2">
                    <a href={oorepLink(detail.r.path)} target="_blank" rel="noopener noreferrer" className="btn-ghost" title="Check this rubric in Kent's Repertory on oorep.com (needs internet)"><ExternalLink size={15} /> Kent on OOREP</a>
                    <button onClick={() => add(detail.r)} disabled={pickedIds.has(detail.r.id)} className="btn-gold">
                      {pickedIds.has(detail.r.id) ? <Check size={16} /> : <ListPlus size={16} />} {pickedIds.has(detail.r.id) ? 'In the case' : 'Add to case'}
                    </button>
                  </div>
                </div>
                <p className="mb-3 mt-1 text-[11px] text-gold-200/40">{detail.remedies.length} remedies · <span className="font-bold uppercase text-gold-200">BOLD</span> = grade 3 · <span className="font-semibold italic text-gold-300">italic</span> = grade 2 · plain = grade 1</p>
                {detail.remedies.length ? <Remedies list={detail.remedies} /> : <p className="text-sm text-gold-200/50">No remedies listed in this rubric itself — open a sub-rubric.</p>}
                {detail.kids.length > 0 && (
                  <div className="mt-5">
                    <p className="label">Sub-rubrics ({detail.kids.length})</p>
                    <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-gold-500/10">
                      {detail.kids.map(k => <RubricRow key={k.id} r={k} added={pickedIds.has(k.id)} onOpen={setOpen} onAdd={add} />)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass overflow-hidden">
                <div className="border-b border-gold-500/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gold-200/45">
                  {results ? `${results.total.toLocaleString('en-IN')} rubrics found${results.total > results.items.length ? ` · showing first ${results.items.length} — add more words to narrow` : ''}` : chapter >= 0 ? `${rep.rubric(chapter).leaf} · ${browse.length} rubrics` : 'Chapters'}
                </div>
                <div className="max-h-[36rem] overflow-y-auto">
                  {results && !results.items.length && <Empty icon={Search} title="No rubric found" text="Try fewer or different words, or pick All chapters." />}
                  {(results ? results.items : browse).map(r => (
                    results || chapter >= 0
                      ? <RubricRow key={r.id} r={r} added={pickedIds.has(r.id)} onOpen={setOpen} onAdd={add} />
                      : (
                        <button key={r.id} onClick={() => setChapter(r.id)} className="flex w-full items-center justify-between border-b border-gold-500/10 px-4 py-2.5 text-left text-sm text-gold-200 last:border-0 hover:bg-gold-500/5">
                          {r.leaf}<span className="flex items-center gap-1 text-[11px] text-gold-200/40">{r.children} rubrics <ChevronRight size={14} /></span>
                        </button>
                      )
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4 lg:col-span-2">
            <div className="glass p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-gold-200">Case rubrics <span className="text-gold-400/70">({picked.length})</span></h3>
                {picked.length > 0 && <button onClick={clear} className="text-xs font-semibold text-gold-300/70 hover:text-gold-200">Clear</button>}
              </div>
              {!picked.length ? (
                <p className="text-sm text-gold-200/50">Search or browse, then press <Plus size={13} className="inline" /> to add the patient's symptoms here.</p>
              ) : (
                <ol className="space-y-2">
                  {picked.map((p, i) => (
                    <li key={p.id} className="flex items-start gap-2 rounded-xl border border-gold-500/10 bg-night-950/40 p-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full gold-fill text-[10px] font-bold text-ink">{i + 1}</span>
                      <button onClick={() => setOpen(p.id)} className="min-w-0 flex-1 text-left text-[13px] leading-snug text-gold-200 hover:underline">{p.path}</button>
                      <button onClick={() => toggleElim(p.id)} title="Eliminating rubric: keep only remedies found in this rubric" className={`h-6 shrink-0 rounded-md px-1.5 text-[10px] font-bold ${p.elim ? 'bg-rose-400/80 text-ink' : 'border border-gold-500/20 text-gold-300/60'}`}>E</button>
                      <div className="flex shrink-0 gap-0.5" title="Importance of this symptom">
                        {[1, 2, 3].map(n => (
                          <button key={n} onClick={() => setIntensity(p.id, n)} className={`h-6 w-6 rounded-md text-[11px] font-bold ${p.intensity === n ? 'gold-fill text-ink' : 'border border-gold-500/20 text-gold-300/70'}`}>{n}</button>
                        ))}
                      </div>
                      <button onClick={() => remove(p.id)} className="p-1 text-gold-300/50 hover:text-rose-300" aria-label="Remove"><X size={14} /></button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {ranked.length > 0 && (
              <div className="glass p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-semibold text-gold-200">Result</h3>
                  <div className="flex rounded-xl border border-gold-500/15 p-0.5 text-[11px] font-semibold">
                    {[['coverage', 'Totality'], ['score', 'Sum of grades'], ['kent', 'Kent']].map(([k, label]) => (
                      <button key={k} onClick={() => setSortBy(k)} className={`rounded-lg px-2.5 py-1 ${sortBy === k ? 'gold-fill text-ink' : 'text-gold-200/60'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                {selected && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold-400/30 bg-gold-500/10 px-3 py-2">
                    <p className="text-sm text-gold-200">Selected: <span className="font-bold">{selected.name}</span> <span className="text-gold-200/55">· {selected.count}/{picked.length} rubrics · score {selected.score}</span></p>
                    <button onClick={() => save(selected)} disabled={busy || !pid} title={pid ? '' : 'Choose the patient in Save to patient first'} className="btn-gold px-3 py-1.5 text-xs"><Pill size={14} /> Prescribe {selected.abbrev}</button>
                  </div>
                )}
                {analysis.elimCols.length > 0 && (
                  <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-rose-300/25 bg-rose-500/5 px-2.5 py-1.5 text-[11px] text-rose-100"><Filter size={12} /> Elimination on rubric {analysis.elimCols.map(c => c + 1).join(', ')} · {analysis.kept.length} of {analysis.all.length} remedies kept</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-gold-200/40">
                        <th className="py-1.5 pr-2 font-semibold">Remedy</th>
                        <th className="px-1 py-1.5 text-right font-semibold">Score</th>
                        <th className="px-1 py-1.5 text-right font-semibold">Rubrics</th>
                        {picked.map((p, i) => <th key={p.id} className="w-6 px-0.5 py-1.5 text-center font-semibold" title={p.path}>{i + 1}</th>)}
                        <th className="w-7" />
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((r, i) => (
                        <tr key={r.idx} onClick={() => setChosen(r.idx)} className={`cursor-pointer border-t border-gold-500/10 ${selected?.idx === r.idx ? 'bg-gold-500/20 text-gold-100 ring-1 ring-inset ring-gold-400/50' : `hover:bg-gold-500/5 ${i < 3 ? 'text-gold-200' : 'text-gold-200/70'}`}`}>
                          <td className="py-1.5 pr-2" title={r.name}><span className={i < 3 ? 'font-bold' : ''}>{r.abbrev}</span></td>
                          <td className="px-1 py-1.5 text-right tabular-nums">{r.score}</td>
                          <td className="px-1 py-1.5 text-right tabular-nums">{r.count}/{picked.length}</td>
                          {r.grades.map((g, c) => (
                            <td key={c} className="px-0.5 py-1.5 text-center">
                              {g ? <span className={`inline-block h-2.5 w-2.5 rounded-full ${g === 3 ? 'bg-gold-300' : g === 2 ? 'bg-gold-500/70' : 'bg-gold-500/30'}`} title={`Grade ${g}`} /> : <span className="text-gold-500/20">·</span>}
                            </td>
                          ))}
                          <td className="pl-1 text-right">
                            <button onClick={e => { e.stopPropagation(); setChosen(r.idx); setFocus(r.idx) }} className="rounded-md p-1 text-gold-400/70 hover:bg-gold-500/15 hover:text-gold-200" aria-label={`Why ${r.abbrev}`} title="Why this remedy"><Info size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10.5px] text-gold-200/40">Totality: most rubrics covered first. Sum of grades: highest score first. Kent: score with each rubric's importance doubled for 3 and halved for 1. Score = grade × importance. Tap a remedy to select it; tap ⓘ to see the rubrics it was chosen for.</p>
              </div>
            )}

            <RemedyDialog
              remedy={focused}
              rubrics={picked}
              onClose={() => setFocus(null)}
              action={
                <>
                  <span className="mr-auto text-[11px] text-gold-200/45">{pid ? `Saves the analysis to ${patient?.name || 'the patient'} and opens the consultation` : 'Choose the patient in "Save to patient" first'}</span>
                  <button onClick={() => { const r = focused; setFocus(null); save(r) }} disabled={busy || !pid} className="btn-gold"><Pill size={16} /> Prescribe {focused?.abbrev}</button>
                </>
              }
            />

            {ranked.length > 1 && (
              <div className="glass p-4 sm:p-5">
                <h3 className="mb-3 font-display text-xl font-semibold text-gold-200">Top remedies</h3>
                <BarList items={ranked.slice(0, 10).map(r => ({ label: `${r.abbrev} · ${r.name}`, value: sortBy === 'coverage' ? r.count : r.score, sub: sortBy === 'coverage' ? `rubrics · score ${r.score}` : `score · ${r.count}/${picked.length} rubrics` }))} />
              </div>
            )}

            {picked.length > 0 && (
              <div className="glass space-y-3 p-4 sm:p-5">
                <h3 className="font-display text-xl font-semibold text-gold-200">{editingId ? 'Update saved repertorisation' : 'Save to patient'}</h3>
                <Field label="Patient">
                  <PatientPicker value={pid} onChange={v => { setPid(v); if (v !== pid) setForVisit(null) }} />
                </Field>
                {forVisit && (
                  <p className="flex items-center justify-between gap-2 rounded-xl border border-gold-500/15 bg-night-950/40 px-3 py-2 text-xs text-gold-200/70">
                    <span>For the consultation on <span className="font-semibold text-gold-200">{new Date(forVisit.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></span>
                    <button onClick={() => setForVisit(null)} className="text-gold-300/60 hover:text-gold-200" aria-label="Not for this visit"><X size={13} /></button>
                  </p>
                )}
                <Field label="Note (optional)">
                  <textarea rows="2" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Chosen remedy, reasoning" />
                </Field>
                <button onClick={() => save()} disabled={busy} className="btn-gold">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save to case</button>
              </div>
            )}

            <p className="px-1 text-[10.5px] leading-relaxed text-gold-200/35">{rep.info.name} by {rep.info.author} · {rep.info.licence} · from the OpenRep / OOREP projects. A Kent-style repertory, not a word-for-word copy of Kent's 1897 book.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function ResultGrid({ rubrics, results, limit = 30 }) {
  const [pick, setPick] = useState(null)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gold-200/40">
            <th className="py-1.5 pr-2 font-semibold">#</th>
            <th className="py-1.5 pr-2 font-semibold">Remedy</th>
            <th className="px-1 py-1.5 text-right font-semibold">Score</th>
            <th className="px-1 py-1.5 text-right font-semibold">Rubrics</th>
            {rubrics.map((p, i) => <th key={i} className="w-6 px-0.5 py-1.5 text-center font-semibold" title={p.path}>{i + 1}</th>)}
            <th className="w-7" />
          </tr>
        </thead>
        <tbody>
          {results.slice(0, limit).map((r, i) => (
            <tr key={r.abbrev} onClick={() => setPick(r)} className={`cursor-pointer border-t border-gold-500/10 hover:bg-gold-500/5 ${i < 3 ? 'text-gold-200' : 'text-gold-200/70'}`}>
              <td className="py-1.5 pr-2 tabular-nums text-gold-200/40">{i + 1}</td>
              <td className="py-1.5 pr-2" title={r.name}><span className={i < 3 ? 'font-bold' : ''}>{r.abbrev}</span> <span className="hidden text-[11px] text-gold-200/40 sm:inline">{r.name}</span></td>
              <td className="px-1 py-1.5 text-right tabular-nums">{r.score}</td>
              <td className="px-1 py-1.5 text-right tabular-nums">{r.count}/{rubrics.length}</td>
              {(r.grades || []).map((g, c) => (
                <td key={c} className="px-0.5 py-1.5 text-center tabular-nums">{g ? <span className={g === 3 ? 'font-bold text-gold-200' : g === 2 ? 'text-gold-300' : 'text-gold-200/50'}>{g}</span> : <span className="text-gold-500/20">·</span>}</td>
              ))}
              <td className="pl-1 text-right"><Info size={15} className="inline text-gold-400/70" aria-label="Why this remedy" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <RemedyDialog remedy={pick} rubrics={rubrics} onClose={() => setPick(null)} />
    </div>
  )
}

export async function completeResults(entry) {
  if (entry.results && entry.results.length) return entry.results
  const rep = await loadRepertory()
  const picked = entry.rubrics.map(r => ({ id: rep.rubric(r.id)?.path === r.path ? r.id : rep.findByPath(r.path), path: r.path, intensity: r.intensity || 1 })).filter(p => p.id >= 0)
  return sortResults(repertorise(rep, picked), entry.sortBy || 'coverage').slice(0, 30).map(r => ({ abbrev: r.abbrev, name: r.name, score: r.score, count: r.count, grades: r.grades }))
}

function SavedRepertorisation({ r, patientId, go }) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState(r.results || null)
  useEffect(() => {
    if (open && !results) completeResults(r).then(setResults).catch(() => setResults([]))
  }, [open, results, r])
  return (
    <li className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button onClick={() => setOpen(o => !o)} className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gold-200">
            <ChevronDown size={15} className={`shrink-0 text-gold-400 transition ${open ? 'rotate-180' : ''}`} />
            {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {r.rubrics.length} rubrics{r.visitId ? ' · consultation' : ''}
          </p>
          <p className="mt-1 text-[13px] text-gold-200/70">
            {r.top.slice(0, 6).map((t, i) => (
              <span key={t.abbrev} title={t.name} className={i === 0 ? 'font-bold text-gold-200' : ''}>{i > 0 ? ' · ' : ''}{t.abbrev} {t.count}/{r.rubrics.length} ({t.score})</span>
            ))}
          </p>
          {r.prescribed && <p className="mt-1 text-xs text-emerald-200/80">Prescribed: <span className="font-semibold">{r.prescribed.name}</span></p>}
          {r.note && <p className="mt-1 text-xs italic text-gold-200/55">{r.note}</p>}
        </button>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => setOpen(o => !o)} className="btn-ghost px-3 py-1.5 text-xs">{open ? 'Hide' : 'Full repertorisation'}</button>
          <button onClick={() => go({ name: 'repertory', patientId, load: r, nonce: Date.now() })} className="btn-ghost px-3 py-1.5 text-xs">Open</button>
          <button onClick={() => deleteRepertorisation(patientId, r.id)} className="rounded-lg p-2 text-gold-300/60 hover:bg-rose-500/10 hover:text-rose-300" aria-label="Delete"><Trash2 size={15} /></button>
        </div>
      </div>
      {open && (
        <div className="mt-4 space-y-4 border-t border-gold-500/10 pt-4">
          <div>
            <p className="label">Rubrics · {r.source || 'Repertorium Publicum'}</p>
            <ol className="space-y-1.5">
              {r.rubrics.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-gold-200">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full gold-fill text-[10px] font-bold text-ink">{i + 1}</span>
                  <span className="min-w-0 flex-1">{p.path}</span>
                  <span className="shrink-0 text-[11px] text-gold-200/45">importance {p.intensity || 1}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="label">Result · numbers are the remedy's grade in each rubric · tap a remedy to see its rubrics</p>
            {!results ? <p className="flex items-center gap-2 text-xs text-gold-200/50"><Loader2 size={14} className="animate-spin" /> Working it out…</p> : <ResultGrid rubrics={r.rubrics} results={results} />}
          </div>
        </div>
      )}
    </li>
  )
}

export function Repertorisations({ patientId, go }) {
  const c = useLiveQuery(() => db.cases.get(patientId), [patientId])
  const list = c?.repertorisations || []
  return (
    <div className="glass mt-5 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-gold-200">Repertorisations</h3>
          <p className="text-xs text-gold-200/50">Every repertorisation for this patient, with its full rubrics and result · included when you print the case sheet</p>
        </div>
        <button onClick={() => go({ name: 'repertory', patientId, nonce: Date.now() })} className="btn-gold"><BookOpenCheck size={16} /> New repertorisation</button>
      </div>
      {!list.length ? (
        <p className="text-sm text-gold-200/50">None saved yet.</p>
      ) : (
        <ul className="space-y-3">
          {list.map(r => <SavedRepertorisation key={r.id} r={r} patientId={patientId} go={go} />)}
        </ul>
      )}
    </div>
  )
}
