import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { deptTone } from '../lib/db.js'
import { initials } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'

export function Crest({ className = 'h-12 w-12' }) {
  return <img src="./icons/crest.png" alt="Gayathri Multi Speciality Clinic" className={className + ' object-contain drop-shadow-[0_8px_24px_rgba(212,165,55,.35)]'} draggable="false" />
}

export function DeptChip({ dept }) {
  const { t } = useT()
  if (!dept) return null
  return <span className={'chip ' + deptTone(dept)}>{t(`dept.${dept}`)}</span>
}

export function Avatar({ name, gender, size = 'h-11 w-11 text-sm' }) {
  const ring = gender === 'Female' ? 'from-pink-300 via-gold-400 to-royal-400' : 'from-gold-300 via-gold-500 to-royal-500'
  return (
    <div className={`shrink-0 rounded-full bg-gradient-to-br p-[1.5px] ${ring} ${size.split(' ').slice(0, 2).join(' ')}`}>
      <div className={`grid h-full w-full place-items-center rounded-full bg-night-800 font-display font-bold text-gold-300 ${size.split(' ').slice(2).join(' ')}`}>
        {initials(name)}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, wide }) {
  const { tx } = useT()
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key !== 'Escape') return
      const all = document.querySelectorAll('[data-modal-open="1"]')
      if (all[all.length - 1] === ref.current) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      setTimeout(() => {
        if (!document.querySelector('[data-modal-open="1"]')) document.body.style.overflow = ''
      }, 0)
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div ref={ref} data-modal-open="1" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={`glass relative flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div>
                <h3 className="font-display text-2xl font-semibold gold-text">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-gold-200/50">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-gold-300/70 hover:bg-night-600/60 hover:text-gold-200" aria-label={tx('Close')}>
                <X size={18} />
              </button>
            </div>
            <div className="hairline mx-6" />
            <div className="overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setItems(s => [...s, { id, msg, kind }])
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map(t => (
            <motion.div key={t.id} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="glass pointer-events-auto flex items-center gap-2.5 px-4 py-3 text-sm">
              {t.kind === 'ok' ? <CheckCircle2 size={18} className="text-gold-400" /> : <AlertTriangle size={18} className="text-rose-300" />}
              <span className="text-gold-200">{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/20 bg-night-700/50">
        <Icon size={26} className="text-gold-400" />
      </div>
      <h4 className="font-display text-xl font-semibold text-gold-300">{title}</h4>
      <p className="mt-1 max-w-sm text-sm text-gold-200/50">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-gold-500/80">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-semibold leading-tight gold-text sm:text-5xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={'block ' + className}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
