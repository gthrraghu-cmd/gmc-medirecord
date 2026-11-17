import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ToastProvider } from './components/ui.jsx'
import Shell, { NAV } from './components/Shell.jsx'
import CommandPalette, { ShortcutsModal } from './components/CommandPalette.jsx'
import Lock from './pages/Lock.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Patients from './pages/Patients.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import FollowUps from './pages/FollowUps.jsx'
import Settings from './pages/Settings.jsx'
import Billing from './pages/Billing.jsx'
import Schedule from './pages/Schedule.jsx'
import Reports from './pages/Reports.jsx'
import PatientForm from './pages/PatientForm.jsx'
import { getProfile } from './lib/db.js'
import { LangProvider, useT } from './lib/i18n.jsx'
import { getThemePref, resolveTheme, setThemePref } from './lib/theme.js'
import { runAutoBackup } from './lib/autobackup.js'
import { FolderSync, X } from 'lucide-react'

function typingIn(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function Main() {
  const { tx } = useT()
  const [unlocked, setUnlocked] = useState(false)
  const [view, setView] = useState({ name: 'dashboard' })
  const [newOpen, setNewOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [backupAsk, setBackupAsk] = useState(null)
  const [profile, setProfile] = useState({ clinicName: 'Gayathri Multi Speciality Clinic', doctor: '', qualification: '', regNo: '', clinicPhone: '', clinicAddress: '', autoLock: '10', docLang: 'en' })
  const timer = useRef(null)

  useEffect(() => {
    getProfile().then(setProfile)
  }, [])

  const go = useCallback(v => {
    setView(v)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const lock = useCallback(() => {
    setUnlocked(false)
    setNewOpen(false)
    setPaletteOpen(false)
    setHelpOpen(false)
  }, [])

  const actions = useMemo(() => ({
    newPatient: () => setNewOpen(true),
    lock,
    toggleTheme: () => setThemePref(resolveTheme(getThemePref()) === 'dark' ? 'light' : 'dark')
  }), [lock])

  useEffect(() => {
    const mins = Number(profile.autoLock)
    if (!unlocked || !mins) return
    const reset = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(lock, mins * 60 * 1000)
    }
    const evts = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    evts.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer.current)
      evts.forEach(e => window.removeEventListener(e, reset))
    }
  }, [unlocked, profile.autoLock, lock])

  useEffect(() => {
    if (!unlocked) return
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
        return
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const digit = e.code?.startsWith('Digit') ? Number(e.code.slice(5)) : NaN
        if (digit >= 1 && digit <= NAV.length) {
          e.preventDefault()
          go({ name: NAV[digit - 1].key })
          return
        }
        const k = e.code
        if (k === 'KeyN') { e.preventDefault(); setNewOpen(true) }
        else if (k === 'KeyB') { e.preventDefault(); go({ name: 'schedule', open: 'book', nonce: Date.now() }) }
        else if (k === 'KeyW') { e.preventDefault(); go({ name: 'schedule', open: 'walkin', nonce: Date.now() }) }
        else if (k === 'KeyT') { e.preventDefault(); actions.toggleTheme() }
        else if (k === 'KeyL') { e.preventDefault(); lock() }
        return
      }
      if (e.key === '?' && !typingIn(document.activeElement) && !document.querySelector('[role="dialog"], .fixed.inset-0.z-50')) {
        e.preventDefault()
        setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unlocked, go, lock, actions])

  useEffect(() => {
    if (!unlocked) return
    const run = () => runAutoBackup().then(r => setBackupAsk(r?.needsPermission ? r.folder : null)).catch(() => {})
    const first = setTimeout(run, 4000)
    const every = setInterval(run, 60 * 60 * 1000)
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [unlocked])

  const allowBackup = async () => {
    try {
      const r = await runAutoBackup({ interactive: true })
      setBackupAsk(r?.needsPermission ? r.folder : null)
    } catch {
      setBackupAsk(null)
    }
  }

  const shortClinic = (profile.clinicName || 'Multi Speciality Clinic').replace(/^Gayathri\s*/i, '') || 'Multi Speciality Clinic'

  if (!unlocked) return <Lock onUnlock={() => setUnlocked(true)} />

  return (
    <Shell view={view} go={go} onLock={lock} onNewPatient={() => setNewOpen(true)} onSearch={() => setPaletteOpen(true)} clinicName={shortClinic}>
      <AnimatePresence mode="wait">
        <motion.div key={view.name + (view.id || '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {view.name === 'dashboard' && <Dashboard go={go} doctor={profile.doctor} />}
          {view.name === 'patients' && <Patients go={go} onNewPatient={() => setNewOpen(true)} />}
          {view.name === 'patient' && <PatientDetail id={view.id} go={go} profile={profile} />}
          {view.name === 'schedule' && <Schedule go={go} profile={profile} open={view.open} nonce={view.nonce} />}
          {view.name === 'followups' && <FollowUps go={go} profile={profile} />}
          {view.name === 'billing' && <Billing go={go} profile={profile} />}
          {view.name === 'reports' && <Reports go={go} />}
          {view.name === 'settings' && <Settings onProfileChange={p => setProfile(s => ({ ...s, ...p }))} />}
        </motion.div>
      </AnimatePresence>
      <PatientForm open={newOpen} onClose={() => setNewOpen(false)} onSaved={id => go({ name: 'patient', id })} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} go={go} actions={actions} />
      <ShortcutsModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      {backupAsk && (
        <div className="no-print fixed bottom-24 right-4 z-40 flex max-w-sm items-center gap-3 rounded-2xl border border-gold-500/30 bg-night-850 p-3 shadow-glow lg:bottom-6">
          <FolderSync size={20} className="shrink-0 text-gold-400" />
          <p className="flex-1 text-xs text-gold-200/80">{tx('Save today’s automatic backup to')} <span className="font-semibold text-gold-200">{backupAsk}</span>?</p>
          <button onClick={allowBackup} className="btn-gold px-3 py-1.5 text-xs">{tx('Allow')}</button>
          <button onClick={() => setBackupAsk(null)} className="rounded-lg p-1 text-gold-300/60 hover:text-gold-200" aria-label={tx('Close')}><X size={14} /></button>
        </div>
      )}
    </Shell>
  )
}

export default function App() {
  return (
    <LangProvider>
      <ToastProvider>
        <Main />
      </ToastProvider>
    </LangProvider>
  )
}
