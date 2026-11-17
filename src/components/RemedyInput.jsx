import { useMemo, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { REMEDIES } from '../lib/remedies.js'

export default function RemedyInput({ value, onChange, used = {}, placeholder = 'Remedy / medicine', className = '', onFocus }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef(null)

  const options = useMemo(() => {
    const names = Array.from(new Set([...Object.keys(used), ...REMEDIES]))
    const s = (value || '').trim().toLowerCase()
    const score = n => {
      const l = n.toLowerCase()
      if (!s) return used[n] ? 1000 + used[n] : -1
      if (l === s) return -1
      if (l.startsWith(s)) return 500 + (used[n] || 0)
      if (l.split(/\s+/).some(w => w.startsWith(s))) return 300 + (used[n] || 0)
      if (l.includes(s)) return 100 + (used[n] || 0)
      return -1
    }
    return names.map(n => [n, score(n)]).filter(([, sc]) => sc >= 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n)
  }, [value, used])

  const pick = n => {
    onChange(n)
    setOpen(false)
  }

  const onKey = e => {
    if (!open || !options.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => (h + 1) % options.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => (h - 1 + options.length) % options.length) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(options[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className={'relative ' + className}>
      <input
        ref={ref}
        className="input"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(0) }}
        onFocus={() => { setOpen(true); onFocus?.() }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      {open && options.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gold-500/25 bg-night-850 p-1 shadow-glow">
          {options.map((n, i) => (
            <li key={n}>
              <button type="button" onMouseDown={e => { e.preventDefault(); pick(n) }} onMouseEnter={() => setHi(i)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === hi ? 'bg-gold-500/15 text-gold-200' : 'text-gold-200/75'}`}>
                <span className="truncate">{n}</span>
                {used[n] ? <span className="flex shrink-0 items-center gap-1 text-[10px] text-gold-400"><Star size={10} className="fill-gold-400" />{used[n]}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
