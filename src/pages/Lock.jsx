import { useEffect, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { Delete, ShieldCheck } from 'lucide-react'
import { Crest } from '../components/ui.jsx'
import { hasPin, setPin, verifyPin } from '../lib/auth.js'
import { useT } from '../lib/i18n.jsx'

const LEN = 4

export default function Lock({ onUnlock }) {
  const [mode, setMode] = useState(null)
  const [pin, setPinVal] = useState('')
  const [first, setFirst] = useState('')
  const [msg, setMsg] = useState('')
  const shake = useAnimationControls()
  const { t } = useT()

  useEffect(() => {
    hasPin().then(h => setMode(h ? 'unlock' : 'create'))
  }, [])

  const fail = async text => {
    setMsg(text)
    setPinVal('')
    await shake.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.4 } })
  }

  const submit = async value => {
    if (mode === 'unlock') {
      if (await verifyPin(value)) onUnlock()
      else fail(t('lock.wrong'))
    } else if (mode === 'create') {
      setFirst(value)
      setPinVal('')
      setMsg('')
      setMode('confirm')
    } else if (mode === 'confirm') {
      if (value === first) {
        await setPin(value)
        onUnlock()
      } else {
        setMode('create')
        setFirst('')
        fail(t('lock.mismatch'))
      }
    }
  }

  const press = d => {
    if (pin.length >= LEN) return
    const v = pin + d
    setPinVal(v)
    setMsg('')
    if (v.length === LEN) setTimeout(() => submit(v), 120)
  }

  const back = () => setPinVal(p => p.slice(0, -1))

  useEffect(() => {
    const onKey = e => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!mode) return null

  const heading = t(mode === 'unlock' ? 'lock.welcome' : mode === 'create' ? 'lock.create' : 'lock.confirm')
  const sub = t(mode === 'unlock' ? 'lock.welcomeSub' : mode === 'create' ? 'lock.createSub' : 'lock.confirmSub')

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-6 py-10">
      <motion.div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-royal-500/25 blur-[120px]" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="relative flex w-full max-w-sm flex-col items-center text-center">
        <motion.div initial={{ scale: 0.8, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 14 }}>
          <Crest className="h-36 w-36 sm:h-44 sm:w-44" />
        </motion.div>
        <h1 className="mt-4 font-display text-4xl font-bold gold-text sm:text-5xl">Gayathri</h1>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.32em] text-gold-400/80">Multi Speciality Clinic</p>
        <p className="mt-1 text-[11px] tracking-[.18em] text-gold-200/40">{t('lock.depts')}</p>

        <div className="hairline my-7 w-full" />

        <h2 className="font-display text-2xl font-semibold text-gold-200">{heading}</h2>
        <p className="mt-1 text-xs text-gold-200/50">{sub}</p>

        <motion.div animate={shake} className="my-6 flex gap-4">
          {Array.from({ length: LEN }).map((_, i) => (
            <motion.span key={i} animate={{ scale: i < pin.length ? 1.15 : 1 }} className={`h-4 w-4 rounded-full border transition ${i < pin.length ? 'border-gold-300 bg-gradient-to-br from-gold-300 to-gold-600 shadow-gold' : 'border-gold-500/40'}`} />
          ))}
        </motion.div>
        <p className="h-5 text-xs text-rose-300">{msg}</p>

        <div className="mt-3 grid w-full max-w-[280px] grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} onClick={() => press(d)} className="aspect-square rounded-full border border-gold-500/20 bg-night-800/60 font-display text-3xl font-semibold text-gold-200 transition hover:border-gold-400/50 hover:bg-night-700 active:scale-95">
              {d}
            </button>
          ))}
          <div className="grid place-items-center text-gold-500/50">
            <ShieldCheck size={22} />
          </div>
          <button onClick={() => press('0')} className="aspect-square rounded-full border border-gold-500/20 bg-night-800/60 font-display text-3xl font-semibold text-gold-200 transition hover:border-gold-400/50 hover:bg-night-700 active:scale-95">
            0
          </button>
          <button onClick={back} className="grid aspect-square place-items-center rounded-full text-gold-300/70 transition hover:text-gold-200 active:scale-95" aria-label="Delete">
            <Delete size={24} />
          </button>
        </div>

        <p className="mt-8 text-[10px] uppercase tracking-[.2em] text-gold-200/30">{t('lock.footer')}</p>
      </motion.div>
    </div>
  )
}
