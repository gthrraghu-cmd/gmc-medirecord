import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Copy, KeyRound, Laptop, Loader2, Power, RefreshCw, ShieldCheck, Smartphone, Database, ChevronDown } from 'lucide-react'
import { Field, Modal, useToast } from './ui.jsx'
import { useSyncStatus, setupFirstDevice, joinDevice, disconnectSync, syncNow, currentCfg, joinCode, readJoinCode } from '../lib/sync.js'

export const SETUP_SQL = `create table if not exists public.gmc_records (
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  table_name text not null,
  record_key text not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  device text,
  payload text,
  server_ts timestamptz not null default clock_timestamp(),
  primary key (owner, table_name, record_key)
);

create index if not exists gmc_records_owner_ts on public.gmc_records (owner, server_ts);

create or replace function public.gmc_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_ts := clock_timestamp();
  return new;
end $$;

drop trigger if exists gmc_touch on public.gmc_records;
create trigger gmc_touch before insert or update on public.gmc_records
  for each row execute function public.gmc_touch();

alter table public.gmc_records enable row level security;

drop policy if exists gmc_select on public.gmc_records;
drop policy if exists gmc_insert on public.gmc_records;
drop policy if exists gmc_update on public.gmc_records;
create policy gmc_select on public.gmc_records for select using (owner = auth.uid());
create policy gmc_insert on public.gmc_records for insert with check (owner = auth.uid());
create policy gmc_update on public.gmc_records for update using (owner = auth.uid()) with check (owner = auth.uid());`

function ago(ts) {
  if (!ts) return 'Not yet'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return 'Just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export { ago }

export function SyncBadge({ compact = false }) {
  const st = useSyncStatus()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])
  if (!st.enabled) return null
  const pg = st.mode === 'postgres'
  const view = {
    syncing: { dot: 'bg-gold-400 animate-pulse', text: pg ? 'Saving to PostgreSQL…' : 'Syncing…' },
    idle: { dot: st.pending ? 'bg-gold-400' : 'bg-emerald-400', text: st.pending ? `${st.pending} to save` : `${pg ? 'PostgreSQL' : 'Synced'} · ${ago(st.lastSync)}` },
    offline: { dot: 'bg-amber-400', text: pg ? `PostgreSQL offline${st.pending ? ` · ${st.pending} waiting` : ''}` : st.pending ? `Offline · ${st.pending} waiting` : 'Offline · will sync later' },
    error: { dot: 'bg-rose-400', text: pg ? 'PostgreSQL needs attention' : 'Sync needs attention' },
    off: { dot: 'bg-gold-500/40', text: 'Sync off' }
  }[st.phase] || { dot: 'bg-gold-500/40', text: '' }
  return (
    <button onClick={() => syncNow()} title={st.message || 'Sync now'} className={`flex items-center justify-center gap-2 text-[11px] text-gold-200/55 hover:text-gold-200 ${compact ? '' : 'w-full'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${view.dot}`} />
      <span className="truncate">{view.text}</span>
    </button>
  )
}

const EMPTY = { code: '', url: '', anonKey: '', email: '', password: '', passphrase: '', passphrase2: '' }

export default function SyncCard() {
  const toast = useToast()
  const st = useSyncStatus()
  const [mode, setMode] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [sqlOpen, setSqlOpen] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)

  useEffect(() => {
    currentCfg().then(setCfg)
  }, [st.enabled])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const pasteCode = e => {
    const code = e.target.value
    const parsed = readJoinCode(code)
    setForm(f => ({ ...f, code, ...(parsed || {}) }))
  }

  const submit = async () => {
    if (mode === 'first' && form.passphrase !== form.passphrase2) return toast('Passphrases do not match', 'err')
    setBusy('connect')
    try {
      const r = mode === 'first' ? await setupFirstDevice(form) : await joinDevice(form)
      if (r.phase === 'error') toast(r.message, 'err')
      else toast(mode === 'first' ? 'Sync is on · records are uploading' : 'Device joined · records are downloading')
      setForm(EMPTY)
      setMode(null)
    } catch (err) {
      toast(err.message || 'Could not connect', 'err')
    }
    setBusy(null)
  }

  const now = async () => {
    setBusy('now')
    await syncNow()
    setBusy(null)
  }

  const copy = async text => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied')
    } catch {
      toast('Could not copy — select and copy by hand', 'err')
    }
  }

  const off = async () => {
    await disconnectSync()
    setConfirmOff(false)
    toast('Sync turned off on this device')
  }

  const header = (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10"><Cloud size={18} className="text-gold-400" /></div>
      <div>
        <h3 className="font-display text-2xl font-semibold text-gold-200">Sync across devices</h3>
        <p className="text-xs text-gold-200/50">Laptop, phone and tablet share the same records — locked with your passphrase before they leave the device</p>
      </div>
    </div>
  )

  if (st.enabled && cfg) {
    const tone = { idle: 'border-emerald-300/25 bg-emerald-500/5', syncing: 'border-gold-400/30 bg-gold-500/5', offline: 'border-amber-300/30 bg-amber-400/5', error: 'border-rose-300/30 bg-rose-500/5' }[st.phase] || 'border-gold-500/10 bg-night-950/40'
    return (
      <div className="glass p-5 sm:p-6">
        {header}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className={`rounded-xl border p-3 ${tone}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-200/50">Status</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-gold-200">
              {st.phase === 'syncing' ? <Loader2 size={14} className="animate-spin text-gold-400" /> : st.phase === 'offline' ? <CloudOff size={14} className="text-amber-300" /> : st.phase === 'error' ? <CloudOff size={14} className="text-rose-300" /> : <ShieldCheck size={14} className="text-emerald-300" />}
              {{ idle: 'In sync', syncing: 'Syncing…', offline: 'Offline', error: 'Needs attention' }[st.phase] || '—'}
            </p>
          </div>
          <div className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-200/45">Last sync</p>
            <p className="mt-0.5 text-sm font-semibold text-gold-200">{ago(st.lastSync)}</p>
          </div>
          <div className="rounded-xl border border-gold-500/10 bg-night-950/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-200/45">To upload</p>
            <p className="mt-0.5 text-sm font-semibold text-gold-200">{st.pending || 0}</p>
          </div>
        </div>
        {st.phase === 'error' && st.message && <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/5 p-3 text-xs text-rose-100">{st.message}</p>}
        <p className="mt-3 text-[11px] text-gold-200/45">Account {cfg.email} · this device {cfg.deviceId}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={now} disabled={!!busy} className="btn-gold">{busy === 'now' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sync now</button>
          <button onClick={() => copy(joinCode(cfg))} className="btn-ghost"><Copy size={16} /> Copy join code</button>
          <button onClick={() => setConfirmOff(true)} className="btn-ghost"><Power size={16} /> Turn off on this device</button>
        </div>
        <p className="mt-3 text-[11px] text-gold-200/40">To add another device: send yourself the join code, then on that device open Settings → Sync → Join this clinic.</p>
        <Modal open={confirmOff} onClose={() => setConfirmOff(false)} title="Turn off sync here?">
          <p className="text-sm text-gold-200/70">Records already on this device stay here. New changes will no longer reach your other devices until you join again.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmOff(false)} className="btn-ghost">Keep sync</button>
            <button onClick={off} className="btn-gold"><Power size={16} /> Turn off</button>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="glass p-5 sm:p-6">
      {header}
      {!mode ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => setMode('first')} className="rounded-2xl border border-gold-500/20 bg-night-950/40 p-4 text-left transition hover:border-gold-400/50">
              <Laptop size={20} className="text-gold-400" />
              <p className="mt-2 font-semibold text-gold-200">Set up the first device</p>
              <p className="mt-1 text-xs text-gold-200/50">Use on the laptop that already has your records. Uploads everything once.</p>
            </button>
            <button onClick={() => setMode('join')} className="rounded-2xl border border-gold-500/20 bg-night-950/40 p-4 text-left transition hover:border-gold-400/50">
              <Smartphone size={20} className="text-gold-400" />
              <p className="mt-2 font-semibold text-gold-200">Join this clinic</p>
              <p className="mt-1 text-xs text-gold-200/50">On a phone or second laptop. Replaces what is here with the clinic records.</p>
            </button>
          </div>
          <button onClick={() => setSqlOpen(o => !o)} className="flex items-center gap-2 text-xs font-semibold text-gold-300 hover:text-gold-200">
            <Database size={14} /> One-time Supabase setup SQL <ChevronDown size={14} className={`transition ${sqlOpen ? 'rotate-180' : ''}`} />
          </button>
          {sqlOpen && (
            <div className="space-y-2">
              <pre className="max-h-64 overflow-auto rounded-xl border border-gold-500/15 bg-night-950/70 p-3 text-[10.5px] leading-relaxed text-gold-200/75">{SETUP_SQL}</pre>
              <button onClick={() => copy(SETUP_SQL)} className="btn-ghost text-xs"><Copy size={14} /> Copy SQL</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {mode === 'join' && (
            <Field label="Join code (from your first device)">
              <input className="input" value={form.code} onChange={pasteCode} placeholder="Paste the code — fills the three boxes below" />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Supabase Project URL">
              <input className="input" value={form.url} onChange={set('url')} placeholder="https://xxxx.supabase.co" autoComplete="off" />
            </Field>
            <Field label="Anon public key">
              <input className="input" value={form.anonKey} onChange={set('anonKey')} placeholder="eyJhbGciOi…" autoComplete="off" />
            </Field>
            <Field label="Sync account email">
              <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="clinic@example.com" autoComplete="username" />
            </Field>
            <Field label="Sync account password">
              <input type="password" className="input" value={form.password} onChange={set('password')} placeholder="Password set in Supabase" autoComplete="current-password" />
            </Field>
          </div>
          <div className="rounded-2xl border border-gold-500/15 bg-night-950/40 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gold-200"><KeyRound size={16} className="text-gold-400" /> Clinic sync passphrase</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={mode === 'first' ? 'Choose a passphrase' : 'Passphrase'}>
                <input type="password" className="input" value={form.passphrase} onChange={set('passphrase')} placeholder="At least 8 characters" autoComplete="new-password" />
              </Field>
              {mode === 'first' && (
                <Field label="Type it again">
                  <input type="password" className="input" value={form.passphrase2} onChange={set('passphrase2')} placeholder="Same passphrase" autoComplete="new-password" />
                </Field>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gold-200/45">Records are locked with this before upload. Supabase never sees it and cannot read your patients. If it is lost, the cloud copy cannot be opened — write it down safely.</p>
          </div>
          {mode === 'join' && <p className="rounded-xl border border-amber-300/30 bg-amber-400/5 p-3 text-xs text-amber-100">Joining replaces the records on this device with the clinic records. Your PIN and backup settings stay.</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={submit} disabled={!!busy} className="btn-gold">{busy ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />} {mode === 'first' ? 'Turn on sync' : 'Join & download'}</button>
            <button onClick={() => { setMode(null); setForm(EMPTY) }} className="btn-ghost">Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
