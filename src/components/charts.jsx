import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    setW(ref.current.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceMax(v, integer) {
  if (v <= 0) return 4
  const raw = v / 4
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / p
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
  if (integer) step = Math.max(1, Math.ceil(step))
  return step * 4
}

export function compactMoney(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `₹${n}`
}

function Tooltip({ x, y, width, children }) {
  const left = Math.min(Math.max(x, 70), width - 70)
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-gold-500/25 bg-night-850 px-3 py-2 text-xs shadow-glow" style={{ left, top: y - 8 }}>
      {children}
    </div>
  )
}

const PAD = { l: 44, r: 8, t: 12, b: 26 }

function Axes({ w, h, max, ticks, fmtY, labels, every }) {
  const iw = w - PAD.l - PAD.r
  const ih = h - PAD.t - PAD.b
  const band = iw / labels.length
  return (
    <g>
      {ticks.map(t => {
        const y = PAD.t + ih - (t / max) * ih
        return (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={PAD.l - 8} y={y + 3} textAnchor="end" className="fill-gold-200/45" fontSize="10">{fmtY(t)}</text>
          </g>
        )
      })}
      {labels.map((l, i) => (i % every === 0 ? (
        <text key={i} x={PAD.l + band * i + band / 2} y={h - 8} textAnchor="middle" className="fill-gold-200/50" fontSize="10">{l}</text>
      ) : null))}
    </g>
  )
}

export function ColumnChart({ data, color = 'var(--series-gold)', format = String, fmtY = String, height = 220, name, integer }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  const max = niceMax(Math.max(0, ...data.map(d => d.value)), integer)
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
  const iw = Math.max(0, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const band = data.length ? iw / data.length : 0
  const bw = Math.max(4, Math.min(40, band - 2 - band * 0.28))
  const every = band < 34 ? 2 : 1

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={name}>
          <Axes w={w} h={height} max={max} ticks={ticks} fmtY={fmtY} labels={data.map(d => d.label)} every={every} />
          {data.map((d, i) => {
            const bh = (d.value / max) * ih
            const x = PAD.l + band * i + (band - bw) / 2
            const y = PAD.t + ih - bh
            const r = Math.min(4, bh)
            const path = bh > 0 ? `M${x},${PAD.t + ih} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${PAD.t + ih} Z` : ''
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent" />
                {path && (
                  <motion.path d={path} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} initial={{ opacity: 0 }} animate={{ opacity: hover === null || hover === i ? 1 : 0.45 }} transition={{ duration: 0.3, delay: hover === null ? i * 0.03 : 0 }} />
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={PAD.l + band * hover + band / 2} y={PAD.t + ih - (data[hover].value / max) * ih} width={w}>
          <p className="text-gold-200/55">{data[hover].full || data[hover].label}</p>
          <p className="font-semibold text-gold-200">{format(data[hover].value)}</p>
        </Tooltip>
      )}
    </div>
  )
}

export function LineChart({ data, color = 'var(--series-gold)', format = String, fmtY = String, height = 220, name, integer }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  const max = niceMax(Math.max(0, ...data.map(d => d.value)), integer)
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
  const iw = Math.max(0, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const band = data.length ? iw / data.length : 0
  const pts = data.map((d, i) => [PAD.l + band * i + band / 2, PAD.t + ih - (d.value / max) * ih])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${PAD.t + ih} L${pts[0][0]},${PAD.t + ih} Z` : ''
  const every = band < 34 ? 2 : 1

  const onMove = e => {
    const r = ref.current.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD.l
    const i = Math.max(0, Math.min(data.length - 1, Math.floor(x / band)))
    setHover(i)
  }

  return (
    <div ref={ref} className="relative w-full" onMouseMove={onMove} onTouchStart={onMove} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={name}>
          <defs>
            <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <Axes w={w} h={height} max={max} ticks={ticks} fmtY={fmtY} labels={data.map(d => d.label)} every={every} />
          <motion.path d={area} fill="url(#lineFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
          <motion.path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          {hover !== null && pts[hover] && (
            <g>
              <line x1={pts[hover][0]} x2={pts[hover][0]} y1={PAD.t} y2={PAD.t + ih} stroke="var(--chart-grid)" strokeWidth="1.5" />
              <circle cx={pts[hover][0]} cy={pts[hover][1]} r="5" fill={color} stroke="var(--chart-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={pts[hover][0]} y={pts[hover][1]} width={w}>
          <p className="text-gold-200/55">{data[hover].full || data[hover].label}</p>
          <p className="font-semibold text-gold-200">{format(data[hover].value)}</p>
        </Tooltip>
      )}
    </div>
  )
}

export function Legend({ series }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map(s => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs text-gold-200/70">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}
        </span>
      ))}
    </div>
  )
}

export function StackedColumns({ labels, fullLabels, series, height = 230, format = String, name }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0))
  const max = niceMax(Math.max(0, ...totals), true)
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
  const iw = Math.max(0, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const band = labels.length ? iw / labels.length : 0
  const bw = Math.max(4, Math.min(40, band - 2 - band * 0.28))
  const every = band < 34 ? 2 : 1

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={name}>
          <Axes w={w} h={height} max={max} ticks={ticks} fmtY={v => v} labels={labels} every={every} />
          {labels.map((_, i) => {
            let base = PAD.t + ih
            const x = PAD.l + band * i + (band - bw) / 2
            const segs = series.map(s => ({ s, v: s.values[i] || 0 })).filter(z => z.v > 0)
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.45}>
                <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent" />
                {segs.map(({ s, v }, k) => {
                  const hgt = (v / max) * ih
                  const y = base - hgt
                  const gap = k < segs.length - 1 ? 2 : 0
                  base = y
                  const top = k === segs.length - 1
                  const rr = top ? Math.min(4, hgt) : 0
                  const yy = y + gap
                  const hh = Math.max(0, hgt - gap)
                  const d = top
                    ? `M${x},${yy + hh} L${x},${yy + rr} Q${x},${yy} ${x + rr},${yy} L${x + bw - rr},${yy} Q${x + bw},${yy} ${x + bw},${yy + rr} L${x + bw},${yy + hh} Z`
                    : `M${x},${yy} h${bw} v${hh} h${-bw} Z`
                  return <path key={s.key} d={d} fill={s.color} />
                })}
              </g>
            )
          })}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={PAD.l + band * hover + band / 2} y={PAD.t + ih - (totals[hover] / max) * ih} width={w}>
          <p className="mb-1 text-gold-200/55">{(fullLabels || labels)[hover]}</p>
          {series.map(s => (
            <p key={s.key} className="flex items-center justify-between gap-4 text-gold-200/80">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.name}</span>
              <span className="font-semibold text-gold-200">{format(s.values[hover] || 0)}</span>
            </p>
          ))}
          <p className="mt-1 flex justify-between border-t border-gold-500/15 pt-1 font-semibold text-gold-200"><span>Total</span><span>{format(totals[hover])}</span></p>
        </Tooltip>
      )}
    </div>
  )
}

export function BarList({ items, format = String, color = 'var(--series-gold)', empty = 'No data in this period' }) {
  const max = Math.max(1, ...items.map(i => i.value))
  if (!items.length) return <p className="py-6 text-center text-sm text-gold-200/40">{empty}</p>
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={it.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-gold-200/85">
              {it.color && <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.color }} />}
              <span className="truncate">{it.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-gold-200">{format(it.value)}{it.sub && <span className="ml-1.5 text-xs font-normal text-gold-200/45">{it.sub}</span>}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-night-950/60">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: it.color || color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gold-500/20 text-left text-[10px] uppercase tracking-[.14em] text-gold-400/80">
            {columns.map((c, i) => <th key={c} className={`py-2 pr-3 font-semibold ${i ? 'text-right' : ''}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gold-500/5">
              {r.map((v, j) => <td key={j} className={`py-2 pr-3 ${j ? 'text-right font-semibold text-gold-200' : 'text-gold-200/75'}`}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GroupedColumns({ labels, fullLabels, series, height = 230, format = String, fmtY = String, name }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  const max = niceMax(Math.max(0, ...series.flatMap(s => s.values)))
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
  const iw = Math.max(0, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const band = labels.length ? iw / labels.length : 0
  const groupW = Math.max(6, Math.min(56, band - 4 - band * 0.24))
  const bw = Math.max(3, (groupW - 2 * (series.length - 1)) / series.length)
  const every = band < 34 ? 2 : 1

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={name}>
          <Axes w={w} h={height} max={max} ticks={ticks} fmtY={fmtY} labels={labels} every={every} />
          {labels.map((_, i) => {
            const x0 = PAD.l + band * i + (band - groupW) / 2
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.45}>
                <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent" />
                {series.map((s, k) => {
                  const v = s.values[i] || 0
                  const bh = (v / max) * ih
                  if (bh <= 0) return null
                  const x = x0 + k * (bw + 2)
                  const y = PAD.t + ih - bh
                  const r = Math.min(4, bh, bw / 2)
                  return <path key={s.key} d={`M${x},${PAD.t + ih} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${PAD.t + ih} Z`} fill={s.color} />
                })}
              </g>
            )
          })}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={PAD.l + band * hover + band / 2} y={PAD.t + ih - (Math.max(...series.map(s => s.values[hover] || 0)) / max) * ih} width={w}>
          <p className="mb-1 text-gold-200/55">{(fullLabels || labels)[hover]}</p>
          {series.map(s => (
            <p key={s.key} className="flex items-center justify-between gap-4 text-gold-200/80">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.name}</span>
              <span className="font-semibold text-gold-200">{format(s.values[hover] || 0)}</span>
            </p>
          ))}
        </Tooltip>
      )}
    </div>
  )
}
