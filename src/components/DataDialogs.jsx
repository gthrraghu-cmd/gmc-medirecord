import { useEffect, useState } from 'react'
import { Eye, EyeOff, ShieldCheck, Download, Send, Lock, FileSpreadsheet, AlertTriangle, Loader2 } from 'lucide-react'
import { Field, Modal, useToast } from './ui.jsx'
import { canShareFiles, createSecureBackup, deliverFile, markBackedUp, readBackupFile, restoreBackup } from '../lib/backup.js'
import { exportExcel } from '../lib/excel.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'

function strength(pw) {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s)
}

const LEVELS = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent']
const BAR = ['bg-rose-400', 'bg-rose-400', 'bg-amber-300', 'bg-emerald-400', 'bg-emerald-300']

function PasswordInput({ value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} className="input pr-11" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} autoComplete="new-password" />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gold-300/60 hover:text-gold-200" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export function BackupDialog({ open, onClose, onDone }) {
  const { tx } = useT()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(null)
  const share = canShareFiles()

  useEffect(() => {
    if (open) {
      setPw('')
      setPw2('')
      setBusy(null)
    }
  }, [open])

  const score = strength(pw)
  const ok = pw.length >= 8 && pw === pw2

  const run = async mode => {
    if (pw.length < 8) return toast(tx('Use at least 8 characters'), 'err')
    if (pw !== pw2) return toast(tx('Passwords do not match'), 'err')
    setBusy(mode)
    try {
      const { blob, filename, counts } = await createSecureBackup(pw)
      const r = await deliverFile(blob, filename, mode)
      if (r === 'cancelled') {
        setBusy(null)
        return
      }
      await markBackedUp()
      toast(`${r === 'shared' ? 'Sent' : 'Saved'} secure backup · ${counts.patients} patients, ${counts.visits} consultations`)
      onDone?.()
      onClose()
    } catch (err) {
      toast(err.message || 'Backup failed', 'err')
    }
    setBusy(null)
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={tx('Secure backup')} subtitle={tx('Everything is locked with your backup password before it leaves this device')}>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-3.5 text-xs text-gold-200/70">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-gold-400" />
          <p>{tx('Patients, consultations, appointments, case sheets, packages and photos are encrypted with AES-256. Without this password nobody can open the file — including us. Write it down somewhere safe.')}</p>
        </div>
        <Field label={tx('Backup password')}>
          <PasswordInput value={pw} onChange={setPw} placeholder={tx('At least 8 characters')} autoFocus />
        </Field>
        {pw && (
          <div>
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map(i => <span key={i} className={`h-1 rounded-full ${i < Math.max(1, score) ? BAR[score] : 'bg-night-600'}`} />)}
            </div>
            <p className="mt-1 text-[11px] text-gold-200/50">{LEVELS[score]}</p>
          </div>
        )}
        <Field label={tx('Confirm password')}>
          <PasswordInput value={pw2} onChange={setPw2} placeholder={tx('Type it again')} />
        </Field>
        {pw2 && pw !== pw2 && <p className="-mt-3 text-xs text-rose-300">{tx('Passwords do not match.')}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => run('save')} disabled={!ok || !!busy} className={share ? 'btn-ghost' : 'btn-gold'}>
            {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {tx('Save to this device')}
          </button>
          {share && (
            <button onClick={() => run('share')} disabled={!ok || !!busy} className="btn-gold">
              {busy === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {tx('Send to my other device')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function RestoreDialog({ file, onClose, onRestored }) {
  const { tx } = useT()
  const toast = useToast()
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMeta(null)
    setError('')
    setPw('')
    if (file) readBackupFile(file).then(setMeta).catch(e => setError(e.message))
  }, [file])

  const run = async () => {
    setBusy(true)
    try {
      const r = await restoreBackup(meta, pw)
      toast(`Restored ${r.patients} patients and ${r.visits} consultations`)
      onRestored?.()
      onClose()
    } catch (err) {
      toast(err.message || 'Restore failed', 'err')
    }
    setBusy(false)
  }

  return (
    <Modal open={!!file} onClose={() => !busy && onClose()} title={tx('Restore backup')} subtitle={file?.name}>
      {error ? (
        <div className="space-y-5">
          <p className="flex items-center gap-2 text-sm text-rose-200"><AlertTriangle size={18} /> {error}</p>
          <div className="flex justify-end"><button onClick={onClose} className="btn-ghost">{tx('Close')}</button></div>
        </div>
      ) : !meta ? (
        <p className="flex items-center gap-2 py-6 text-sm text-gold-200/60"><Loader2 size={16} className="animate-spin" /> {tx('Reading file…')}</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Patients', meta.counts?.patients], ['Consults', meta.counts?.visits], ['Photos', meta.counts?.photos]].map(([l, n]) => (
              <div key={l} className="rounded-xl border border-gold-500/10 bg-night-950/40 py-3">
                <p className="font-display text-2xl font-bold gold-text">{n ?? '—'}</p>
                <p className="text-[10px] uppercase tracking-wider text-gold-200/45">{tx(l)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gold-200/55">
            Backup from <span className="font-semibold text-gold-300">{meta.exportedAt ? new Date(meta.exportedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown date'}</span>
            {meta.encrypted ? ' · password protected' : ' · older unprotected backup'}
          </p>
          {meta.encrypted && (
            <Field label={tx('Backup password')}>
              <PasswordInput value={pw} onChange={setPw} placeholder={tx('Password used when this backup was made')} autoFocus />
            </Field>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/5 p-3 text-xs text-rose-100/80">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-300" />
            {tx('Restoring replaces every record on this device with the backup. Your PIN stays the same.')}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={busy} className="btn-ghost">{tx('Cancel')}</button>
            <button onClick={run} disabled={busy || (meta.encrypted && !pw)} className="btn-gold">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} {tx('Unlock & restore')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function monthRange(offset) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return { from: iso(first), to: iso(last) }
}

const PRESETS = [
  { key: 'all', label: 'All time', range: () => ({ from: '', to: '' }) },
  { key: 'month', label: 'This month', range: () => monthRange(0) },
  { key: 'last', label: 'Last month', range: () => monthRange(-1) },
  { key: 'year', label: 'This year', range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: todayISO() }) },
  { key: 'custom', label: 'Custom' }
]

export function ExportDialog({ open, onClose }) {
  const { tx } = useT()
  const toast = useToast()
  const [preset, setPreset] = useState('all')
  const [range, setRange] = useState({ from: '', to: '' })
  const [busy, setBusy] = useState(null)
  const share = canShareFiles()

  useEffect(() => {
    if (open) {
      setPreset('all')
      setRange({ from: '', to: '' })
      setBusy(null)
    }
  }, [open])

  const choose = p => {
    setPreset(p.key)
    if (p.range) setRange(p.range())
  }

  const run = async mode => {
    setBusy(mode)
    try {
      const { blob, filename, counts } = await exportExcel(range)
      const r = await deliverFile(blob, filename, mode)
      if (r !== 'cancelled') {
        toast(`Excel ready · ${counts.patients} patients, ${counts.visits} consultations`)
        onClose()
      }
    } catch (err) {
      toast(err.message || 'Export failed', 'err')
    }
    setBusy(null)
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={tx('Export to Excel')} subtitle={tx('Six sheets: Patients, Consultations, Payments, Appointments, Packages, Expenses')}>
      <div className="space-y-5">
        <div>
          <span className="label">{tx('Period')}</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.key} type="button" onClick={() => choose(p)} className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${preset === p.key ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>{tx(p.label)}</button>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={tx('From')}><input type="date" className="input" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /></Field>
            <Field label={tx('To')}><input type="date" className="input" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></Field>
          </div>
        )}
        <p className="text-xs text-gold-200/50">
          {range.from || range.to ? `Consultations, payments and appointments from ${range.from ? fmtDate(range.from) : 'the beginning'} to ${range.to ? fmtDate(range.to) : 'today'}.` : tx('Every record on this device.')} The Patients and Packages sheets always list everyone.
        </p>
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3 text-xs text-amber-100/75">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          {tx('The Excel file is not password protected. Keep it on clinic devices only.')}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {share && (
            <button onClick={() => run('share')} disabled={!!busy} className="btn-ghost">
              {busy === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {tx('Share')}
            </button>
          )}
          <button onClick={() => run('save')} disabled={!!busy} className="btn-gold">
            {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} {tx('Download Excel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
