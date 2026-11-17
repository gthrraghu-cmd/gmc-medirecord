import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { FileText, FileUp, Trash2, ExternalLink, FolderOpen, Camera } from 'lucide-react'
import { db, addDocument, deleteDocument } from '../../lib/db.js'
import { preparePhoto } from '../../lib/image.js'
import { fmtDate, todayISO } from '../../lib/format.js'
import { Empty, Field, Modal, useToast } from '../ui.jsx'
import { useT } from '../../lib/i18n.jsx'

const CATEGORIES = ['Lab report', 'Scan / X-ray', 'Outside prescription', 'Discharge summary', 'Consent form', 'Other']
const MAX = 15 * 1024 * 1024

function useBlobUrl(blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}

function size(n) {
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function DocCard({ doc, onOpen }) {
  const { tx } = useT()
  const thumb = useBlobUrl(doc.thumb)
  const isPdf = doc.type === 'application/pdf'
  return (
    <button onClick={onOpen} className="glass group flex w-full items-center gap-3 p-3 text-left transition hover:-translate-y-0.5 hover:border-gold-500/40">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold-500/20 bg-night-950/60">
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <FileText size={24} className={isPdf ? 'text-rose-300' : 'text-gold-400'} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gold-200">{doc.title || doc.name}</p>
        <p className="truncate text-xs text-gold-200/50">{tx(doc.category)} · {fmtDate(doc.date)}</p>
        <p className="truncate text-[11px] text-gold-200/35">{isPdf ? 'PDF' : tx('Image')} · {size(doc.size)}</p>
      </div>
    </button>
  )
}

function Viewer({ doc, onClose, onDelete }) {
  const { tx } = useT()
  const url = useBlobUrl(doc?.blob)
  const isPdf = doc?.type === 'application/pdf'
  return (
    <Modal open={!!doc} onClose={onClose} wide title={doc?.title || doc?.name || ''} subtitle={doc ? `${tx(doc.category)} · ${fmtDate(doc.date)}${doc.note ? ` · ${doc.note}` : ''}` : ''}>
      {doc && url && (
        <div className="space-y-4">
          {isPdf ? (
            <iframe src={url} title={doc.name} className="h-[62vh] w-full rounded-xl border border-gold-500/20 bg-white" />
          ) : (
            <img src={url} alt={doc.name} className="mx-auto max-h-[62vh] w-auto rounded-xl border border-gold-500/20 object-contain" />
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <button onClick={onDelete} className="btn-danger px-3 py-2 text-xs"><Trash2 size={14} /> {tx('Delete')}</button>
            <a href={url} target="_blank" rel="noopener noreferrer" download={doc.name} className="btn-ghost px-3 py-2 text-xs"><ExternalLink size={14} /> {tx('Open / download')}</a>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Documents({ patient }) {
  const { tx } = useT()
  const toast = useToast()
  const fileRef = useRef(null)
  const camRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [meta, setMeta] = useState({ category: 'Lab report', date: todayISO(), title: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(null)
  const [cat, setCat] = useState('All')

  const docs = useLiveQuery(() => db.documents.where('patientId').equals(patient.id).toArray().then(a => a.sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt))), [patient.id])
  if (!docs) return null

  const cats = ['All', ...CATEGORIES.filter(c => docs.some(d => d.category === c))]
  const shown = cat === 'All' ? docs : docs.filter(d => d.category === cat)
  const viewing = view ? docs.find(d => d.id === view) : null

  const pick = e => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    const ok = files.filter(f => (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size <= MAX)
    if (ok.length < files.length) toast(tx('Only PDF or images up to 15 MB'), 'err')
    if (!ok.length) return
    setMeta({ category: 'Lab report', date: todayISO(), title: ok.length === 1 ? ok[0].name.replace(/\.[^.]+$/, '') : '', note: '' })
    setPending(ok)
  }

  const save = async () => {
    setBusy(true)
    try {
      for (const f of pending) {
        if (f.type === 'application/pdf') {
          await addDocument({ patientId: patient.id, ...meta, title: pending.length === 1 ? meta.title : f.name.replace(/\.[^.]+$/, ''), name: f.name, type: f.type, size: f.size, blob: f })
        } else {
          const ph = await preparePhoto(f)
          await addDocument({ patientId: patient.id, ...meta, title: pending.length === 1 ? meta.title : f.name.replace(/\.[^.]+$/, ''), name: f.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: ph.blob.size, blob: ph.blob, thumb: ph.thumb })
        }
      }
      toast(tx('Documents saved on this device'))
      setPending(null)
    } catch (err) {
      toast(err.message || tx('Could not save'), 'err')
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-gold-200">{tx('Reports & documents')}</h3>
          <p className="text-xs text-gold-200/45">{tx('Lab reports, scans and outside prescriptions — kept only on this device')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => camRef.current?.click()} className="btn-ghost"><Camera size={16} /> {tx('Scan with camera')}</button>
          <button onClick={() => fileRef.current?.click()} className="btn-gold"><FileUp size={16} /> {tx('Add document')}</button>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={pick} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="glass">
          <Empty icon={FolderOpen} title={tx('No documents yet')} text={tx('Add PDF lab reports or photograph paper reports with the camera. They stay with this patient’s record and in your backups.')} />
        </div>
      ) : (
        <>
          {cats.length > 2 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {cats.map(c => (
                <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${cat === c ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>{tx(c)}</button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                <DocCard doc={d} onOpen={() => setView(d.id)} />
              </motion.div>
            ))}
          </div>
        </>
      )}

      <Modal open={!!pending} onClose={() => !busy && setPending(null)} title={tx('Add document')} subtitle={`${pending?.length || 0} · ${patient.name}`}>
        {pending && (
          <div className="space-y-5">
            <ul className="space-y-1.5">
              {pending.map(f => (
                <li key={f.name + f.size} className="flex items-center gap-2 rounded-lg border border-gold-500/10 bg-night-950/40 px-3 py-2 text-xs text-gold-200/75">
                  <FileText size={14} className="text-gold-400" /><span className="flex-1 truncate">{f.name}</span><span className="text-gold-200/40">{size(f.size)}</span>
                </li>
              ))}
            </ul>
            <div>
              <span className="label">{tx('Category')}</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button type="button" key={c} onClick={() => setMeta(m => ({ ...m, category: c }))} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${meta.category === c ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>{tx(c)}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {pending.length === 1 && (
                <Field label={tx('Title')} className="sm:col-span-2">
                  <input className="input" value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} placeholder="CBC, Thyroid profile…" />
                </Field>
              )}
              <Field label={tx('Report date')}>
                <input type="date" className="input" value={meta.date} onChange={e => setMeta(m => ({ ...m, date: e.target.value }))} />
              </Field>
              <Field label={tx('Note')}>
                <input className="input" value={meta.note} onChange={e => setMeta(m => ({ ...m, note: e.target.value }))} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPending(null)} disabled={busy} className="btn-ghost">{tx('Cancel')}</button>
              <button onClick={save} disabled={busy} className="btn-gold">{busy ? tx('Saving…') : tx('Save')}</button>
            </div>
          </div>
        )}
      </Modal>

      <Viewer doc={viewing} onClose={() => setView(null)} onDelete={async () => { await deleteDocument(viewing.id); setView(null); toast(tx('Document deleted')) }} />
    </div>
  )
}
