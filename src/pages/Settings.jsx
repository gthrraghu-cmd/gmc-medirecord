import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, KeyRound, DatabaseBackup, Upload, MonitorSmartphone, HardDrive, ShieldCheck, ShieldAlert, FileSpreadsheet, ArrowLeftRight, Lock, Send, Palette, Keyboard } from 'lucide-react'
import { db, getProfile, getSetting, setSetting } from '../lib/db.js'
import { setPin, verifyPin } from '../lib/auth.js'
import { Field, PageHeader, useToast } from '../components/ui.jsx'
import { BackupDialog, ExportDialog, RestoreDialog } from '../components/DataDialogs.jsx'
import AutoBackupCard from '../components/AutoBackupCard.jsx'
import { TemplatesCard } from '../components/Templates.jsx'
import { useT } from '../lib/i18n.jsx'
import { getThemePref, setThemePref } from '../lib/theme.js'
import { SHORTCUTS } from '../components/CommandPalette.jsx'

function Card({ icon: Icon, title, text, children, className = '' }) {
  return (
    <div className={`glass p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10"><Icon size={18} className="text-gold-400" /></div>
        <div>
          <h3 className="font-display text-2xl font-semibold text-gold-200">{title}</h3>
          {text && <p className="text-xs text-gold-200/50">{text}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function ago(ts, tx) {
  if (!ts) return tx('Never')
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d === 0) return tx('Today')
  if (d === 1) return tx('Yesterday')
  return `${d} ${tx('days')}`
}

export default function Settings({ onProfileChange }) {
  const { tx } = useT()
  const toast = useToast()
  const fileRef = useRef(null)
  const [profile, setProfile] = useState({ clinicName: '', doctor: '', qualification: '', regNo: '', clinicPhone: '', clinicAddress: '', autoLock: '10' })
  const [pins, setPins] = useState({ cur: '', next: '', again: '' })
  const [restoreFile, setRestoreFile] = useState(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [usage, setUsage] = useState(null)
  const [persisted, setPersisted] = useState(null)
  const { t: tr } = useT()
  const [themePref, setThemePrefState] = useState(getThemePref())
  const lastBackup = useLiveQuery(() => getSetting('lastBackup', 0), [])
  const every = useLiveQuery(() => getSetting('backupEvery', 7), [])
  const counts = useLiveQuery(async () => ({ p: await db.patients.count(), v: await db.visits.count(), ph: await db.photos.count() }), [])

  useEffect(() => {
    getProfile().then(p => setProfile(s => ({ ...s, ...p })))
    navigator.storage?.estimate?.().then(e => setUsage(e))
    navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const saveProfile = async e => {
    e.preventDefault()
    await setSetting('profile', profile)
    onProfileChange?.(profile)
    toast(tx('Clinic profile saved'))
  }

  const changePin = async e => {
    e.preventDefault()
    if (!(await verifyPin(pins.cur))) return toast(tx('Current PIN is incorrect'), 'err')
    if (!/^\d{4}$/.test(pins.next)) return toast(tx('New PIN must be 4 digits'), 'err')
    if (pins.next !== pins.again) return toast(tx('New PINs do not match'), 'err')
    await setPin(pins.next)
    setPins({ cur: '', next: '', again: '' })
    toast(tx('PIN changed'))
  }

  const protect = async () => {
    const ok = await navigator.storage?.persist?.()
    setPersisted(!!ok)
    toast(ok ? 'Storage protected from automatic clearing' : 'The browser declined. Install the app to protect storage.', ok ? 'ok' : 'err')
  }

  const chooseTheme = p => {
    setThemePref(p)
    setThemePrefState(p)
  }


  const afterRestore = async () => {
    const p = await getProfile()
    setProfile(s => ({ ...s, ...p }))
    onProfileChange?.(p)
  }

  const set = k => e => setProfile(s => ({ ...s, [k]: e.target.value }))
  const setP = k => e => setPins(s => ({ ...s, [k]: e.target.value.replace(/\D/g, '').slice(0, 4) }))
  const days = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null
  const overdue = (counts?.p || 0) > 0 && Number(every) > 0 && (days === null || days >= Number(every))

  return (
    <div>
      <PageHeader eyebrow={tr('settings.eyebrow')} title={tr('settings.title')} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card icon={DatabaseBackup} title={tx('Secure backup')} text={tx('Records live only on this device — keep an encrypted copy elsewhere')} className={overdue ? 'border-amber-300/40' : ''}>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3">
              <p className="font-display text-2xl font-bold gold-text">{counts?.p ?? '—'}</p>
              <p className="text-[10px] uppercase tracking-wider text-gold-200/45">{tx('Patients')}</p>
            </div>
            <div className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3">
              <p className="font-display text-2xl font-bold gold-text">{counts?.v ?? '—'}</p>
              <p className="text-[10px] uppercase tracking-wider text-gold-200/45">{tx('Consults')}</p>
            </div>
            <div className={`rounded-xl border p-3 ${overdue ? 'border-amber-300/40 bg-amber-400/10' : 'border-gold-500/10 bg-night-950/40'}`}>
              <p className={`font-display text-lg font-bold leading-8 ${overdue ? 'text-amber-200' : 'gold-text'}`}>{ago(lastBackup, tx)}</p>
              <p className="text-[10px] uppercase tracking-wider text-gold-200/45">{tx('Last backup')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBackupOpen(true)} className="btn-gold"><Lock size={16} /> {tx('Create secure backup')}</button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost"><Upload size={16} /> {tx('Restore')}</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => { if (e.target.files[0]) setRestoreFile(e.target.files[0]); e.target.value = '' }} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label={tx('Remind me to back up')}>
              <select className="input" value={String(every ?? 7)} onChange={async e => { await setSetting('backupEvery', Number(e.target.value)); toast(tx('Reminder updated')) }}>
                <option value="1">{tx('Every day')}</option>
                <option value="3">{tx('Every 3 days')}</option>
                <option value="7">{tx('Every week')}</option>
                <option value="14">{tx('Every 2 weeks')}</option>
                <option value="0">{tx('Never')}</option>
              </select>
            </Field>
            <div>
              <span className="label">{tx('Storage protection')}</span>
              {persisted ? (
                <p className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-200"><ShieldCheck size={16} /> {tx('Protected from clearing')}</p>
              ) : (
                <button onClick={protect} className="flex w-full items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-400/5 px-3 py-2.5 text-left text-xs text-amber-100 hover:bg-amber-400/10"><ShieldAlert size={16} className="text-amber-300" /> {tx('Not protected · tap to protect')}</button>
              )}
            </div>
          </div>
          {usage && (
            <p className="mt-3 flex items-center gap-2 text-[11px] text-gold-200/40">
              <HardDrive size={13} /> Using {(usage.usage / 1024 / 1024).toFixed(1)} MB on this device{counts?.ph ? ` · ${counts.ph} photos` : ''}
            </p>
          )}
        </Card>

        <AutoBackupCard />

        <Card icon={ArrowLeftRight} title={tx('Move to another device')} text={tx('Laptop ↔ phone, or a new device')}>
          <ol className="space-y-3">
            {[
              ['Create a secure backup here', 'Choose a password and tap “Send to my other device” — WhatsApp it to yourself, Nearby Share, Quick Share, email or Drive. On a laptop, “Save to this device” and copy it across.'],
              ['Open MediRecord on the other device', 'Install it from the same link if it is not there yet.'],
              ['Restore on the other device', 'Settings → Restore → pick the file → enter the same backup password.']
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center gold-fill rounded-full font-display text-sm font-bold text-ink">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-gold-200">{tx(t)}</p>
                  <p className="text-xs text-gold-200/50">{tx(d)}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11px] text-gold-200/40">{tx('Restoring replaces the records on the receiving device, so always move from the device with the latest work.')}</p>
          <button onClick={() => setBackupOpen(true)} className="btn-ghost mt-4"><Send size={16} /> {tx('Start transfer')}</button>
        </Card>

        <Card icon={FileSpreadsheet} title={tx('Export to Excel')} text={tx('For accounts, audits and reports')}>
          <ul className="mb-4 grid grid-cols-2 gap-2 text-xs text-gold-200/65 sm:grid-cols-3">
            {['Patients', 'Consultations', 'Payments', 'Appointments', 'Packages', 'Expenses'].map(s => (
              <li key={s} className="flex items-center gap-2 rounded-lg border border-gold-500/10 bg-night-950/40 px-3 py-2"><span className="h-1.5 w-1.5 rounded-full bg-gold-400" />{tx(s)}</li>
            ))}
          </ul>
          <button onClick={() => setExportOpen(true)} className="btn-gold"><FileSpreadsheet size={16} /> {tx('Export to Excel')}</button>
        </Card>

        <Card icon={Palette} title="Appearance" text="Choose how the app looks on this device">
          <div className="space-y-5">
            <div>
              <span className="label">{tx('Theme')}</span>
              <div className="grid grid-cols-3 gap-2">
                {[['dark', 'Royal night'], ['light', 'Ivory light'], ['system', 'Match device']].map(([k, l]) => (
                  <button key={k} onClick={() => chooseTheme(k)} className={`rounded-xl border p-2 text-xs font-semibold transition ${themePref === k ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/55 hover:border-gold-500/35'}`}>
                    <span className={`mb-1.5 block h-8 rounded-lg border border-gold-500/20 ${k === 'dark' ? 'bg-[#1c0630]' : k === 'light' ? 'bg-[#f8f3ea]' : 'bg-gradient-to-r from-[#1c0630] from-50% to-[#f8f3ea] to-50%'}`} />
                    {tx(l)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <TemplatesCard />

        <Card icon={Keyboard} title={tx('Keyboard shortcuts')} text={tx('For the clinic laptop')}>
          <ul className="divide-y divide-gold-500/10 text-sm">
            {SHORTCUTS.map(([keys, label]) => (
              <li key={label} className="flex items-center justify-between gap-3 py-2">
                <span className="text-gold-200/70">{tx(label)}</span>
                <span className="flex shrink-0 gap-1">{keys.map(k => <kbd key={k}>{k}</kbd>)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card icon={Building2} title={tx('Clinic profile')} text={tx('Printed on every prescription, receipt and daily closing')}>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label={tx('Clinic name')} className="sm:col-span-2">
              <input className="input" value={profile.clinicName} onChange={set('clinicName')} placeholder="Gayathri Multi Speciality Clinic" />
            </Field>
            <Field label={tx('Doctor name')}>
              <input className="input" value={profile.doctor} onChange={set('doctor')} placeholder="Dr. Gayathri" />
            </Field>
            <Field label={tx('Qualification')}>
              <input className="input" value={profile.qualification} onChange={set('qualification')} placeholder="BHMS, MD (Hom)" />
            </Field>
            <Field label={tx('Registration no.')}>
              <input className="input" value={profile.regNo} onChange={set('regNo')} />
            </Field>
            <Field label={tx('Clinic phone')}>
              <input className="input" value={profile.clinicPhone} onChange={set('clinicPhone')} />
            </Field>
            <Field label={tx('Clinic address')} className="sm:col-span-2">
              <input className="input" value={profile.clinicAddress} onChange={set('clinicAddress')} />
            </Field>
            <Field label={tx('Auto-lock after')}>
              <select className="input" value={profile.autoLock} onChange={set('autoLock')}>
                <option value="5">{tx('5 minutes idle')}</option>
                <option value="10">{tx('10 minutes idle')}</option>
                <option value="30">{tx('30 minutes idle')}</option>
                <option value="0">{tx('Never')}</option>
              </select>
            </Field>
            <div className="flex items-end justify-end">
              <button className="btn-gold">{tx('Save profile')}</button>
            </div>
          </form>
        </Card>

        <Card icon={KeyRound} title={tx('Change PIN')} text={tx('4-digit PIN that unlocks the app')}>
          <form onSubmit={changePin} className="grid gap-4 sm:grid-cols-3">
            <Field label={tx('Current')}>
              <input type="password" inputMode="numeric" className="input tracking-[.5em]" value={pins.cur} onChange={setP('cur')} />
            </Field>
            <Field label={tx('New')}>
              <input type="password" inputMode="numeric" className="input tracking-[.5em]" value={pins.next} onChange={setP('next')} />
            </Field>
            <Field label={tx('Confirm')}>
              <input type="password" inputMode="numeric" className="input tracking-[.5em]" value={pins.again} onChange={setP('again')} />
            </Field>
            <div className="flex justify-end sm:col-span-3">
              <button className="btn-gold">{tx('Update PIN')}</button>
            </div>
          </form>
        </Card>

        <Card icon={MonitorSmartphone} title={tx('Install as an app')} text={tx('One-time setup per device; works offline afterwards')}>
          <ul className="space-y-3 text-sm text-gold-200/70">
            <li><span className="font-semibold text-gold-300">Windows (Edge / Chrome):</span> open the app link → click the install icon in the address bar → “Install”.</li>
            <li><span className="font-semibold text-gold-300">Android (Chrome):</span> ⋮ menu → “Add to Home screen” → “Install”.</li>
            <li><span className="font-semibold text-gold-300">iPhone (Safari):</span> Share → “Add to Home Screen”.</li>
          </ul>
        </Card>
      </div>

      <BackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
      <RestoreDialog file={restoreFile} onClose={() => setRestoreFile(null)} onRestored={afterRestore} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
