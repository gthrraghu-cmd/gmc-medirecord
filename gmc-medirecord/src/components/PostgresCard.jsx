import { useEffect, useState } from 'react'
import { Database, Loader2, Plug, Power, RefreshCw, ServerCrash, ShieldCheck, Table2 } from 'lucide-react'
import { Field, Modal, useToast } from './ui.jsx'
import { ago } from './SyncCard.jsx'
import { useSyncStatus, connectPostgres, disconnectSync, syncNow, currentCfg } from '../lib/sync.js'

const EMPTY = { host: 'localhost', port: '5432', user: 'postgres', password: '', database: 'gmc_medirecord' }

export default function PostgresCard() {
  const toast = useToast()
  const st = useSyncStatus()
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const on = st.enabled && st.mode === 'postgres' && cfg?.mode === 'postgres'

  useEffect(() => {
    currentCfg().then(setCfg)
  }, [st.enabled, st.mode])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const connect = async () => {
    setBusy('connect')
    try {
      const { info, state } = await connectPostgres(form)
      setCfg(await currentCfg())
      if (state.phase === 'error' || state.phase === 'offline') toast(state.message, 'err')
      else toast(`Connected to ${info.database} · ${info.patients} patients already in PostgreSQL`)
      setForm(f => ({ ...f, password: '' }))
    } catch (err) {
      toast(err.message || 'Could not connect to PostgreSQL', 'err')
    }
    setBusy(null)
  }

  const now = async () => {
    setBusy('now')
    await syncNow()
    setBusy(null)
  }

  const off = async () => {
    await disconnectSync()
    setCfg(null)
    setConfirmOff(false)
    toast('Disconnected from PostgreSQL')
  }

  const header = (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10"><Database size={18} className="text-gold-400" /></div>
      <div>
        <h3 className="font-display text-2xl font-semibold text-gold-200">PostgreSQL database</h3>
        <p className="text-xs text-gold-200/50">Every patient, consultation, payment, photo and document is saved into PostgreSQL on this laptop</p>
      </div>
    </div>
  )

  if (on) {
    const tone = { idle: 'border-emerald-300/25 bg-emerald-500/5', syncing: 'border-gold-400/30 bg-gold-500/5', offline: 'border-amber-300/30 bg-amber-400/5', error: 'border-rose-300/30 bg-rose-500/5' }[st.phase] || 'border-gold-500/10 bg-night-950/40'
    return (
      <div className="glass p-5 sm:p-6">
        {header}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className={`rounded-xl border p-3 ${tone}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-200/50">Status</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-gold-200">
              {st.phase === 'syncing' ? <Loader2 size={14} className="animate-spin text-gold-400" /> : st.phase === 'idle' ? <ShieldCheck size={14} className="text-emerald-300" /> : <ServerCrash size={14} className={st.phase === 'offline' ? 'text-amber-300' : 'text-rose-300'} />}
              {{ idle: 'Saved', syncing: 'Saving…', offline: 'Not reachable', error: 'Needs attention' }[st.phase] || '—'}
            </p>
          </div>
          <div className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-200/45">Last saved</p>
            <p className="mt-0.5 text-sm font-semibold text-gold-200">{ago(st.lastSync)}</p>
          </div>
          <div className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-200/45">Waiting</p>
            <p className="mt-0.5 text-sm font-semibold text-gold-200">{st.pending || 0}</p>
          </div>
        </div>
        {(st.phase === 'error' || st.phase === 'offline') && st.message && (
          <p className={`mt-3 rounded-xl border p-3 text-xs ${st.phase === 'offline' ? 'border-amber-300/30 bg-amber-400/5 text-amber-100' : 'border-rose-300/30 bg-rose-500/5 text-rose-100'}`}>
            {st.message} The app keeps working and saves the waiting changes as soon as PostgreSQL is back.
          </p>
        )}
        <p className="mt-3 text-[11px] text-gold-200/45">Database {cfg.database} on {cfg.host}:{cfg.port} · user {cfg.user}</p>
        <div className="mt-3 rounded-xl border border-gold-500/10 bg-night-950/40 p-3 text-[11px] text-gold-200/55">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-gold-300"><Table2 size={13} /> In pgAdmin</p>
          Schema <span className="font-mono text-gold-200">medirecord</span> · ready-made views <span className="font-mono text-gold-200">patient_list</span>, <span className="font-mono text-gold-200">consultation_list</span>, <span className="font-mono text-gold-200">expense_list</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={now} disabled={!!busy} className="btn-gold">{busy === 'now' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Save now</button>
          <button onClick={() => setConfirmOff(true)} className="btn-ghost"><Power size={16} /> Disconnect</button>
        </div>
        <Modal open={confirmOff} onClose={() => setConfirmOff(false)} title="Disconnect PostgreSQL?">
          <p className="text-sm text-gold-200/70">Records already in PostgreSQL and in the app stay as they are. New changes will be kept only inside the app until you connect again.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmOff(false)} className="btn-ghost">Stay connected</button>
            <button onClick={off} className="btn-gold"><Power size={16} /> Disconnect</button>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="glass p-5 sm:p-6">
      {header}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Host">
          <input className="input" value={form.host} onChange={set('host')} autoComplete="off" />
        </Field>
        <Field label="Port">
          <input className="input" inputMode="numeric" value={form.port} onChange={set('port')} autoComplete="off" />
        </Field>
        <Field label="User">
          <input className="input" value={form.user} onChange={set('user')} autoComplete="off" />
        </Field>
        <Field label="Password">
          <input type="password" className="input" value={form.password} onChange={set('password')} placeholder="Your PostgreSQL password" autoComplete="current-password" />
        </Field>
        <Field label="Database name">
          <input className="input" value={form.database} onChange={set('database')} autoComplete="off" />
        </Field>
      </div>
      <p className="mt-3 text-[11px] text-gold-200/45">The database and tables are created automatically if they do not exist. Records already in the app are copied in; records already in PostgreSQL come into the app. The password is stored encrypted by Windows for this user only.</p>
      <button onClick={connect} disabled={!!busy} className="btn-gold mt-4">{busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />} Connect & save to PostgreSQL</button>
    </div>
  )
}
