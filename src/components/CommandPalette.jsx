import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, CornerDownLeft, UserPlus, CalendarPlus, UserRoundPlus, Lock, SunMoon, ArrowRight } from 'lucide-react'
import { db } from '../lib/db.js'
import { useT } from '../lib/i18n.jsx'
import { Avatar, Modal } from './ui.jsx'
import { NAV } from './Shell.jsx'

export const SHORTCUTS = [
  [['Ctrl', 'K'], 'Search patients & commands'],
  [['Alt', '1–7'], 'Go to a section'],
  [['Alt', 'N'], 'New patient'],
  [['Alt', 'B'], 'Book appointment'],
  [['Alt', 'W'], 'Walk-in token'],
  [['Alt', 'T'], 'Switch light / dark'],
  [['Alt', 'L'], 'Lock the app'],
  [['?'], 'Show shortcuts'],
  [['Esc'], 'Close any dialog']
]

export function ShortcutsModal({ open, onClose }) {
  const { tx } = useT()
  return (
    <Modal open={open} onClose={onClose} title={tx('Keyboard shortcuts')} subtitle={tx('Work faster on the clinic laptop')}>
      <ul className="divide-y divide-gold-500/10 text-sm">
        {SHORTCUTS.map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-gold-200/75">{tx(label)}</span>
            <span className="flex gap-1">{keys.map(k => <kbd key={k}>{k}</kbd>)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default function CommandPalette({ open, onClose, go, actions }) {
  const { tx } = useT()
  const { t } = useT()
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const patients = useLiveQuery(() => (open ? db.patients.toArray() : []), [open]) || []

  useEffect(() => {
    if (open) {
      setQ('')
      setHi(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    const cmds = [
      { id: 'new', icon: UserPlus, label: t('action.newPatient'), hint: 'Alt N', run: actions.newPatient },
      { id: 'book', icon: CalendarPlus, label: 'Book appointment', hint: 'Alt B', run: () => go({ name: 'schedule', open: 'book', nonce: Date.now() }) },
      { id: 'walk', icon: UserRoundPlus, label: 'Walk-in token', hint: 'Alt W', run: () => go({ name: 'schedule', open: 'walkin', nonce: Date.now() }) },
      ...NAV.map((n, i) => ({ id: 'go-' + n.key, icon: n.icon, label: `${t(n.label)}`, sub: 'Go to', hint: `Alt ${i + 1}`, run: () => go({ name: n.key }) })),
      { id: 'theme', icon: SunMoon, label: 'Switch light / dark theme', hint: 'Alt T', run: actions.toggleTheme },
      { id: 'lock', icon: Lock, label: t('action.lock'), hint: 'Alt L', run: actions.lock }
    ]
    const cmdHits = s ? cmds.filter(c => (c.label + ' ' + (c.sub || '')).toLowerCase().includes(s)) : cmds
    const pHits = s
      ? patients.filter(p => [p.name, p.phone, p.altPhone, p.code].some(v => (v || '').toLowerCase().includes(s))).slice(0, 7)
      : [...patients].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4)
    return [
      ...pHits.map(p => ({ id: 'p' + p.id, patient: p, run: () => go({ name: 'patient', id: p.id }) })),
      ...cmdHits
    ]
  }, [q, patients, t, go, actions])

  useEffect(() => setHi(0), [q])

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  const run = item => {
    onClose()
    setTimeout(() => item.run?.(), 10)
  }

  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(items.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && items[hi]) { e.preventDefault(); run(items[hi]) }
    else if (e.key === 'Escape') onClose()
  }

  const firstCmd = items.findIndex(i => !i.patient)

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-night-950/75 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: -14, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 320 }} className="glass relative w-full max-w-xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gold-500/15 px-4 py-3.5">
              <Search size={18} className="text-gold-400" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder={tx('Search patients by name, mobile or GMC ID, or type a command…')} className="flex-1 bg-transparent text-base text-gold-200 outline-none placeholder:text-gold-200/35" />
              <kbd>Esc</kbd>
            </div>
            <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-2">
              {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-gold-200/40">No patient or command matches “{q}”.</p>}
              {items.map((it, i) => (
                <div key={it.id}>
                  {i === 0 && it.patient && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-gold-400/70">{q ? tx('Patients') : tx('Recent patients')}</p>}
                  {i === firstCmd && <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.18em] text-gold-400/70">{tx('Commands')}</p>}
                  <button data-i={i} onMouseEnter={() => setHi(i)} onClick={() => run(it)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${hi === i ? 'bg-gold-500/15' : ''}`}>
                    {it.patient ? (
                      <>
                        <Avatar name={it.patient.name} gender={it.patient.gender} size="h-8 w-8 text-[11px]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gold-200">{it.patient.name}</p>
                          <p className="truncate text-[11px] text-gold-200/45">{it.patient.code}{it.patient.phone ? ` · ${it.patient.phone}` : ''}</p>
                        </div>
                        <ArrowRight size={14} className={hi === i ? 'text-gold-400' : 'text-transparent'} />
                      </>
                    ) : (
                      <>
                        <span className="grid h-8 w-8 place-items-center rounded-lg border border-gold-500/20 bg-night-700/60"><it.icon size={15} className="text-gold-400" /></span>
                        <span className="flex-1 text-sm text-gold-200/85">{it.sub && <span className="text-gold-200/45">{tx(it.sub)} · </span>}{tx(it.label)}</span>
                        {it.hint && <span className="hidden gap-1 sm:flex">{it.hint.split(' ').map(k => <kbd key={k}>{k}</kbd>)}</span>}
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-gold-500/10 px-4 py-2 text-[11px] text-gold-200/40">
              <span className="flex items-center gap-1.5"><kbd>↑</kbd><kbd>↓</kbd> {tx('move')} <kbd><CornerDownLeft size={10} /></kbd> {tx('open')}</span>
              <span>{tx('Press')} <kbd>?</kbd> {tx('for all shortcuts')}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
