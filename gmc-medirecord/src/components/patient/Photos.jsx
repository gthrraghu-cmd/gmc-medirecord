import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Camera, ImagePlus, Trash2, SplitSquareHorizontal, Images, ChevronsLeftRight } from 'lucide-react'
import { db, addPhoto, deletePhoto, updatePhoto } from '../../lib/db.js'
import { preparePhoto } from '../../lib/image.js'
import { fmtDate, todayISO } from '../../lib/format.js'
import { Empty, Field, Modal, useToast } from '../ui.jsx'
import { useT } from '../../lib/i18n.jsx'

const KINDS = ['Before', 'Progress', 'After']
const AREAS = ['Face', 'Forehead', 'Left cheek', 'Right cheek', 'Chin', 'Neck', 'Scalp', 'Back', 'Shoulder', 'Knee', 'Hands', 'Feet']
const kindTone = { Before: 'bg-sky-500/80', Progress: 'bg-royal-500/80', After: 'bg-emerald-500/80' }

function useBlobUrl(blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}

function Thumb({ photo, onClick, selected, compact }) {
  const { tx } = useT()
  const url = useBlobUrl(photo.thumb || photo.blob)
  return (
    <button onClick={onClick} className={`group relative aspect-square overflow-hidden rounded-xl border transition ${selected ? 'border-gold-400 ring-2 ring-gold-400/50' : 'border-gold-500/15 hover:border-gold-500/45'}`}>
      {url && <img src={url} alt={photo.area} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
      {compact ? (
        <span className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-white ${kindTone[photo.kind] || kindTone.Progress}`}>{tx(photo.kind)}</span>
      ) : (
        <>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-950/90 to-transparent px-2 pb-1.5 pt-6 text-left">
            <p className="truncate text-[11px] font-semibold text-gold-200">{photo.area || 'Photo'}</p>
            <p className="text-[10px] text-gold-200/60">{fmtDate(photo.date)}</p>
          </div>
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white ${kindTone[photo.kind] || kindTone.Progress}`}>{tx(photo.kind)}</span>
        </>
      )}
    </button>
  )
}

function Full({ blob, className }) {
  const url = useBlobUrl(blob)
  return url ? <img src={url} alt="" className={className} draggable="false" /> : null
}

function CompareSlider({ before, after }) {
  const [pos, setPos] = useState(50)
  const box = useRef(null)
  const drag = useRef(false)

  const move = clientX => {
    const r = box.current.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  return (
    <div
      ref={box}
      className="relative aspect-[4/5] w-full select-none overflow-hidden rounded-2xl border border-gold-500/25 bg-night-950 sm:aspect-[4/3]"
      onPointerDown={e => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX) }}
      onPointerMove={e => drag.current && move(e.clientX)}
      onPointerUp={() => { drag.current = false }}
      style={{ touchAction: 'none' }}
    >
      <Full blob={after.blob} className="absolute inset-0 h-full w-full object-contain" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Full blob={before.blob} className="absolute inset-0 h-full w-full bg-night-950 object-contain" />
      </div>
      <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-gradient-to-b from-gold-300 via-gold-500 to-gold-300 shadow-gold" />
        <div className="absolute top-1/2 -ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full border-2 border-gold-300 bg-night-900/90 text-gold-300 shadow-gold">
          <ChevronsLeftRight size={18} />
        </div>
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-sky-500/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Before · {fmtDate(before.date)}</span>
      <span className="absolute right-3 top-3 rounded-full bg-emerald-500/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">After · {fmtDate(after.date)}</span>
    </div>
  )
}

export default function Photos({ patient }) {
  const { tx } = useT()
  const toast = useToast()
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [meta, setMeta] = useState({ kind: 'Before', area: 'Face', date: todayISO(), note: '' })
  const [busy, setBusy] = useState(false)
  const [area, setArea] = useState('All')
  const [view, setView] = useState(null)
  const [compare, setCompare] = useState(null)

  const photos = useLiveQuery(() => db.photos.where('patientId').equals(patient.id).toArray().then(a => a.sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt))), [patient.id])
  const hasAny = (photos || []).length > 0

  const pendingUrls = useMemo(() => (pending ? pending.map(f => URL.createObjectURL(f)) : []), [pending])
  useEffect(() => () => pendingUrls.forEach(u => URL.revokeObjectURL(u)), [pendingUrls])

  if (!photos) return null

  const areas = ['All', ...Array.from(new Set(photos.map(p => p.area).filter(Boolean)))]
  const shown = area === 'All' ? photos : photos.filter(p => p.area === area)

  const pick = e => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    setMeta(m => ({ ...m, kind: hasAny ? 'Progress' : 'Before', date: todayISO() }))
    setPending(files)
  }

  const save = async () => {
    setBusy(true)
    try {
      for (const file of pending) {
        const ph = await preparePhoto(file)
        await addPhoto({ patientId: patient.id, ...meta, ...ph })
      }
      toast(`${pending.length} photo${pending.length > 1 ? 's' : ''} saved on this device`)
      setPending(null)
    } catch (err) {
      toast(err.message || 'Could not save photo', 'err')
    }
    setBusy(false)
  }

  const openCompare = () => {
    const pool = shown.length >= 2 ? shown : photos
    const sorted = [...pool].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt))
    const before = sorted.find(p => p.kind === 'Before') || sorted[0]
    const after = [...sorted].reverse().find(p => p.kind === 'After' && p.id !== before.id) || sorted[sorted.length - 1]
    setCompare({ before: before.id, after: after.id })
  }

  const byId = id => photos.find(p => p.id === id)
  const viewing = view ? byId(view) : null

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-gold-200">{tx('Before & after')}</h3>
          <p className="text-xs text-gold-200/45">{tx('Photos are compressed and kept only on this device')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {photos.length >= 2 && <button onClick={openCompare} className="btn-ghost"><SplitSquareHorizontal size={16} /> {tx('Compare')}</button>}
          <button onClick={() => fileRef.current?.click()} className="btn-ghost"><ImagePlus size={16} /> {tx('Upload')}</button>
          <button onClick={() => camRef.current?.click()} className="btn-gold"><Camera size={16} /> {tx('Take photo')}</button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
        </div>
      </div>

      {!hasAny ? (
        <div className="glass">
          <Empty icon={Images} title={tx('No photos yet')} text={tx('Capture a ‘Before’ photo at the first cosmetology visit, then add progress and ‘After’ photos to compare results side by side.')} />
        </div>
      ) : (
        <>
          {areas.length > 2 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {areas.map(a => (
                <button key={a} onClick={() => setArea(a)} className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${area === a ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>{a}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                <Thumb photo={p} onClick={() => setView(p.id)} />
              </motion.div>
            ))}
          </div>
        </>
      )}

      <Modal open={!!pending} onClose={() => !busy && setPending(null)} title={tx('Add photos')} subtitle={`${pending?.length || 0} selected · ${patient.name}`}>
        {pending && (
          <div className="space-y-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pendingUrls.map(u => <img key={u} src={u} alt="" className="h-24 w-24 shrink-0 rounded-xl border border-gold-500/20 object-cover" />)}
            </div>
            <div>
              <span className="label">{tx('Stage')}</span>
              <div className="grid grid-cols-3 gap-2">
                {KINDS.map(k => (
                  <button type="button" key={k} onClick={() => setMeta(m => ({ ...m, kind: k }))} className={`rounded-xl border py-2.5 text-sm font-semibold transition ${meta.kind === k ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>{tx(k)}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tx('Area')}>
                <input className="input" list="photo-areas" value={meta.area} onChange={e => setMeta(m => ({ ...m, area: e.target.value }))} />
                <datalist id="photo-areas">{AREAS.map(a => <option key={a} value={a} />)}</datalist>
              </Field>
              <Field label={tx('Date')}>
                <input type="date" className="input" value={meta.date} onChange={e => setMeta(m => ({ ...m, date: e.target.value }))} />
              </Field>
              <Field label={tx('Note')} className="sm:col-span-2">
                <input className="input" value={meta.note} onChange={e => setMeta(m => ({ ...m, note: e.target.value }))} placeholder="Session 2 · after glycolic peel" />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPending(null)} disabled={busy} className="btn-ghost">{tx('Cancel')}</button>
              <button onClick={save} disabled={busy} className="btn-gold">{busy ? tx('Saving…') : tx('Save photos')}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewing} onClose={() => setView(null)} wide title={viewing ? `${viewing.area || 'Photo'} · ${tx(viewing.kind)}` : ''} subtitle={viewing ? `${fmtDate(viewing.date)}${viewing.note ? ` · ${viewing.note}` : ''}` : ''}>
        {viewing && (
          <div className="space-y-4">
            <Full blob={viewing.blob} className="mx-auto max-h-[60vh] w-auto rounded-xl border border-gold-500/20 object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {KINDS.map(k => (
                  <button key={k} onClick={() => updatePhoto(viewing.id, { kind: k })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${viewing.kind === k ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50'}`}>{tx(k)}</button>
                ))}
              </div>
              <button onClick={async () => { await deletePhoto(viewing.id); setView(null); toast(tx('Photo deleted')) }} className="btn-danger px-3 py-2 text-xs"><Trash2 size={14} /> {tx('Delete')}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!compare} onClose={() => setCompare(null)} wide title={tx('Compare results')} subtitle={tx('Drag the gold handle to reveal before and after')}>
        {compare && byId(compare.before) && byId(compare.after) && (
          <div className="space-y-4">
            <CompareSlider before={byId(compare.before)} after={byId(compare.after)} />
            <div className="grid gap-3 sm:grid-cols-2">
              {['before', 'after'].map(side => (
                <div key={side}>
                  <span className="label">{side === 'before' ? tx('Before photo') : tx('After photo')}</span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map(p => (
                      <div key={p.id} className="w-16 shrink-0">
                        <Thumb compact photo={p} selected={compare[side] === p.id} onClick={() => setCompare(c => ({ ...c, [side]: p.id }))} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
