import { motion } from 'framer-motion'
import { BookOpenCheck, LayoutDashboard, Users, CalendarClock, Settings, Lock, UserPlus, WifiOff, IndianRupee, CalendarDays, BarChart3, Search, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Crest } from './ui.jsx'
import { SyncBadge } from './SyncCard.jsx'
import { useT } from '../lib/i18n.jsx'
import { getThemePref, resolveTheme, setThemePref } from '../lib/theme.js'

export const NAV = [
  { key: 'dashboard', label: 'nav.dashboard', icon: LayoutDashboard, mobile: true },
  { key: 'patients', label: 'nav.patients', icon: Users, mobile: true },
  { key: 'schedule', label: 'nav.schedule', icon: CalendarDays, mobile: true },
  { key: 'followups', label: 'nav.followups', icon: CalendarClock, mobile: true },
  { key: 'billing', label: 'nav.billing', icon: IndianRupee, mobile: true },
  { key: 'reports', label: 'nav.reports', icon: BarChart3, mobile: false },
  { key: 'repertory', label: 'nav.repertory', icon: BookOpenCheck, mobile: false },
  { key: 'settings', label: 'nav.settings', icon: Settings, mobile: true }
]

function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true)
    const b = () => setOn(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', b)
    return () => {
      window.removeEventListener('online', a)
      window.removeEventListener('offline', b)
    }
  }, [])
  return on
}

export function useThemeState() {
  const [pref, setPref] = useState(getThemePref())
  useEffect(() => {
    const on = e => setPref(e.detail)
    window.addEventListener('gmc-theme', on)
    return () => window.removeEventListener('gmc-theme', on)
  }, [])
  return [pref, resolveTheme(pref)]
}

export default function Shell({ view, go, onLock, onNewPatient, onSearch, clinicName, children }) {
  const { tx } = useT()
  const online = useOnline()
  const { t } = useT()
  const [, theme] = useThemeState()
  const active = view.name === 'patient' ? 'patients' : view.name
  const flipTheme = () => setThemePref(theme === 'dark' ? 'light' : 'dark')

  return (
    <div className="flex min-h-full">
      <aside className="no-print sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-gold-500/10 bg-night-950/60 px-5 py-6 backdrop-blur-xl lg:flex">
        <div className="flex flex-col items-center text-center">
          <Crest className="h-24 w-24" />
          <p className="mt-3 font-display text-2xl font-bold leading-none gold-text">Gayathri</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.28em] text-gold-400/70">{clinicName}</p>
        </div>
        <div className="hairline my-5" />
        <button onClick={onNewPatient} className="btn-gold mb-3 w-full">
          <UserPlus size={16} /> {t('action.newPatient')}
        </button>
        <button onClick={onSearch} className="mb-5 flex w-full items-center gap-2 rounded-xl border border-gold-500/15 bg-night-800/50 px-3 py-2.5 text-sm text-gold-200/50 transition hover:border-gold-500/35 hover:text-gold-200">
          <Search size={15} className="text-gold-400" />
          <span className="flex-1 text-left">{t('action.search')}…</span>
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </button>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map(({ key, label, icon: Icon }, i) => {
            const on = active === key
            return (
              <button key={key} onClick={() => go({ name: key })} title={`Alt+${i + 1}`} className={`group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${on ? 'text-ink' : 'text-gold-200/70 hover:bg-night-700/50 hover:text-gold-200'}`}>
                {on && <motion.span layoutId="navpill" className="gold-fill absolute inset-0 rounded-xl shadow-gold" transition={{ type: 'spring', damping: 28, stiffness: 320 }} />}
                <Icon size={18} className="relative" />
                <span className="relative flex-1 text-left">{t(label)}</span>
                <span className={`relative text-[10px] font-bold opacity-0 transition group-hover:opacity-60 ${on ? 'text-ink' : ''}`}>{i + 1}</span>
              </button>
            )
          })}
        </nav>
        <div className="mt-4 space-y-3">
          <div>
            <button onClick={flipTheme} className="btn-ghost w-full px-2 py-2 text-xs" title={tx('Theme')}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} {theme === 'dark' ? tx('Light') : tx('Dark')}
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 text-center text-[11px] text-gold-200/40">
            {online ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" /> : <WifiOff size={12} />}
            {t('shell.offline')}
          </div>
          <SyncBadge />
          <button onClick={onLock} className="btn-ghost w-full">
            <Lock size={16} /> {t('action.lock')}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-gold-500/10 bg-night-900/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2.5">
            <Crest className="h-10 w-10" />
            <div>
              <p className="font-display text-xl font-bold leading-none gold-text">Gayathri</p>
              <p className="text-[9px] font-semibold uppercase tracking-[.22em] text-gold-400/70">MediRecord</p>
              <div className="mt-1 max-w-[9rem]"><SyncBadge compact /></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSearch} className="btn-ghost px-3 py-2" aria-label={tx('Search')}><Search size={16} /></button>
            <button onClick={onNewPatient} className="btn-gold px-3 py-2" aria-label={tx('New patient')}><UserPlus size={16} /></button>
            <button onClick={onLock} className="btn-ghost px-3 py-2" aria-label={tx('Lock')}><Lock size={16} /></button>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-hidden px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">{children}</main>

        <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-gold-500/15 bg-night-950/90 px-2 pt-2 backdrop-blur-xl lg:hidden">
          {NAV.filter(n => n.mobile).map(({ key, label, icon: Icon }) => {
            const on = active === key
            return (
              <button key={key} onClick={() => go({ name: key })} className="relative flex flex-col items-center gap-1 py-1.5 text-[9.5px] font-semibold">
                {on && <motion.span layoutId="mobpill" className="absolute -top-2 h-0.5 w-10 rounded-full bg-gold-400" />}
                <Icon size={20} className={on ? 'text-gold-400' : 'text-gold-200/40'} />
                <span className={`max-w-full truncate ${on ? 'text-gold-300' : 'text-gold-200/40'}`}>{t(label)}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
