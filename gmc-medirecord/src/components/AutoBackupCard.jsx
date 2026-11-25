import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FolderSync, FolderOpen, Loader2, Power, RefreshCw, Monitor } from 'lucide-react'
import { Field, useToast } from './ui.jsx'
import { useT } from '../lib/i18n.jsx'
import { autoBackupStatus, autoBackupSupported, chooseBackupFolder, runAutoBackup, turnOffAutoBackup } from '../lib/autobackup.js'

export default function AutoBackupCard() {
  const { tx } = useT()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(null)
  const [tick, setTick] = useState(0)
  const status = useLiveQuery(() => autoBackupStatus(), [tick])
  const supported = autoBackupSupported()

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const turnOn = async () => {
    if (pw.length < 8) return toast(tx('Use at least 8 characters'), 'err')
    if (pw !== pw2) return toast(tx('Passwords do not match'), 'err')
    setBusy('on')
    try {
      const name = await chooseBackupFolder(pw)
      const r = await runAutoBackup({ force: true, interactive: true })
      toast(r.done ? `${tx('Automatic backup on')} · ${name}` : tx('Folder saved'))
      setPw('')
      setPw2('')
    } catch (err) {
      if (err?.name !== 'AbortError') toast(err.message || tx('Could not use this folder'), 'err')
    }
    setBusy(null)
    setTick(x => x + 1)
  }

  const now = async () => {
    setBusy('now')
    try {
      const r = await runAutoBackup({ force: true, interactive: true })
      if (r.done) toast(`${tx('Saved')} ${r.name}`)
      else if (r.needsPermission) toast(tx('Allow folder access to continue'), 'err')
    } catch (err) {
      toast(err.message || tx('Backup failed'), 'err')
    }
    setBusy(null)
    setTick(x => x + 1)
  }

  const off = async () => {
    await turnOffAutoBackup()
    toast(tx('Automatic backup turned off'))
    setTick(x => x + 1)
  }

  return (
    <div className="glass p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10"><FolderSync size={18} className="text-gold-400" /></div>
        <div>
          <h3 className="font-display text-2xl font-semibold text-gold-200">{tx('Automatic daily backup')}</h3>
          <p className="text-xs text-gold-200/50">{tx('Saves an encrypted copy to a folder on this laptop every day — keeps the last 14')}</p>
        </div>
      </div>

      {!supported ? (
        <p className="flex items-start gap-2 rounded-xl border border-gold-500/15 bg-night-950/40 p-3 text-xs text-gold-200/60">
          <Monitor size={16} className="mt-0.5 shrink-0 text-gold-400" />
          {tx('Available on the Windows laptop in Edge or Chrome. On phones, use Secure backup above.')}
        </p>
      ) : status?.on ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/5 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/80">{tx('Folder')}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-gold-200"><FolderOpen size={14} className="shrink-0 text-gold-400" />{status.folder}</p>
            </div>
            <div className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-200/45">{tx('Last automatic backup')}</p>
              <p className="mt-0.5 text-sm font-semibold text-gold-200">{status.last ? new Date(status.last).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}</p>
            </div>
          </div>
          {status.permission !== 'granted' && (
            <p className="rounded-xl border border-amber-300/30 bg-amber-400/5 p-3 text-xs text-amber-100">{tx('The browser needs your OK once per session to write to the folder. Press “Back up now” to allow it.')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={now} disabled={!!busy} className="btn-gold">{busy === 'now' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {tx('Back up now')}</button>
            <button onClick={off} className="btn-ghost"><Power size={16} /> {tx('Turn off')}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gold-200/55">{tx('Tip: choose a OneDrive or Google Drive folder so each copy also reaches the cloud.')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tx('Backup password')}>
              <input type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} placeholder={tx('At least 8 characters')} autoComplete="new-password" />
            </Field>
            <Field label={tx('Confirm password')}>
              <input type="password" className="input" value={pw2} onChange={e => setPw2(e.target.value)} placeholder={tx('Type it again')} autoComplete="new-password" />
            </Field>
          </div>
          <p className="text-[11px] text-gold-200/40">{tx('The password is remembered on this laptop so backups can run by themselves. You will need it to restore on another device.')}</p>
          <button onClick={turnOn} disabled={!!busy} className="btn-gold">{busy === 'on' ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />} {tx('Choose folder & turn on')}</button>
        </div>
      )}
    </div>
  )
}
