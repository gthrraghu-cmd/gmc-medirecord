import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, IndianRupee, Stethoscope, UserPlus, Receipt, Clock, BarChart3, Table2, Printer, Wallet, PiggyBank } from 'lucide-react'
import { getProfile } from '../lib/db.js'
import { MonthlyReportDoc } from '../components/PrintSheets.jsx'
import DocPreview from '../components/DocPreview.jsx'
import { db, DEPARTMENTS } from '../lib/db.js'
import { addDaysISO, fmtMoney, todayISO } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'
import { PageHeader } from '../components/ui.jsx'
import { BarList, ColumnChart, DataTable, GroupedColumns, LineChart, Legend, StackedColumns, compactMoney } from '../components/charts.jsx'

const PERIODS = [
  { key: 'month', label: 'This month' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'year', label: 'This year' },
  { key: '12m', label: 'Last 12 months' }
]

const pad = n => String(n).padStart(2, '0')
const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function periodRange(key) {
  const now = new Date()
  const to = todayISO()
  let from
  if (key === 'month') from = isoOf(new Date(now.getFullYear(), now.getMonth(), 1))
  else if (key === '3m') from = isoOf(new Date(now.getFullYear(), now.getMonth() - 2, 1))
  else if (key === 'year') from = `${now.getFullYear()}-01-01`
  else from = isoOf(new Date(now.getFullYear(), now.getMonth() - 11, 1))
  const days = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1
  const prevTo = addDaysISO(from, -1)
  const prevFrom = addDaysISO(prevTo, -(days - 1))
  return { from, to, prevFrom, prevTo }
}

function monthsWindow(key) {
  const now = new Date()
  const count = key === 'year' ? Math.max(6, now.getMonth() + 1) : key === '12m' ? 12 : 6
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    return { key: monthKey(d), label: d.toLocaleDateString('en-IN', { month: 'short' }), full: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
  })
}

const within = (d, a, b) => d && d >= a && d <= b
const paidDate = v => (v.payMode === 'Pending' ? null : v.paidOn || v.date)
const fee = v => Number(v.fee) || 0
const createdISO = p => (p.createdAt ? isoOf(new Date(p.createdAt)) : null)

function Delta({ now, prev, money, invert }) {
  const { tx } = useT()
  if (!prev && !now) return <span className="text-[11px] text-gold-200/40">{tx('No activity yet')}</span>
  if (!prev) return <span className="text-[11px] text-gold-200/45">{tx('New this period')}</span>
  const pct = Math.round(((now - prev) / Math.abs(prev)) * 100)
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  const up = invert ? 'var(--bad)' : 'var(--good)'
  const down = invert ? 'var(--good)' : 'var(--bad)'
  const tone = pct > 0 ? up : pct < 0 ? down : undefined
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: tone }}>
      <Icon size={13} /> {pct > 0 ? '+' : ''}{pct}% <span className="font-normal text-gold-200/45">vs {money ? fmtMoney(prev) : prev} before</span>
    </span>
  )
}

function Kpi({ i, icon: Icon, label, value, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold-400/80">{label}</span>
        <Icon size={16} className="text-gold-400" />
      </div>
      <p className="mt-2 font-display text-3xl font-bold gold-text sm:text-4xl">{value}</p>
      <div className="mt-1 min-h-[18px]">{children}</div>
    </motion.div>
  )
}

function ChartCard({ title, subtitle, table, legend, children, className = '', i = 0 }) {
  const [mode, setMode] = useState('chart')
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className={`glass p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-gold-200 sm:text-2xl">{title}</h3>
          {subtitle && <p className="text-xs text-gold-200/45">{subtitle}</p>}
        </div>
        {table && (
          <div className="flex shrink-0 rounded-lg border border-gold-500/15 p-0.5">
            {[['chart', BarChart3], ['table', Table2]].map(([m, I]) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-md p-1.5 ${mode === m ? 'bg-gold-500/20 text-gold-200' : 'text-gold-200/40 hover:text-gold-200'}`} aria-label={m === 'chart' ? 'Chart view' : 'Table view'}><I size={14} /></button>
            ))}
          </div>
        )}
      </div>
      {legend && mode === 'chart' && <div className="mb-3">{legend}</div>}
      {mode === 'chart' || !table ? children : <DataTable columns={table.columns} rows={table.rows} />}
    </motion.section>
  )
}

function monthlyData(raw, key) {
  const { patients, visits, expenses } = raw
  const [y, m] = key.split('-').map(Number)
  const from = `${key}-01`
  const to = isoOf(new Date(y, m, 0))
  const inM = d => within(d, from, to)
  const cur = visits.filter(v => inM(v.date))
  const paid = visits.filter(v => fee(v) > 0 && inM(paidDate(v)))
  const revenue = paid.reduce((s, v) => s + fee(v), 0)
  const depts = DEPARTMENTS.map(d => ({
    key: d.key,
    consults: cur.filter(v => v.department === d.key).length,
    share: cur.length ? Math.round((cur.filter(v => v.department === d.key).length / cur.length) * 100) : 0,
    revenue: paid.filter(v => v.department === d.key).reduce((s, v) => s + fee(v), 0)
  }))
  const modes = ['Cash', 'UPI', 'Card'].map(mode => ({ mode, count: paid.filter(v => v.payMode === mode).length, amount: paid.filter(v => v.payMode === mode).reduce((s, v) => s + fee(v), 0) }))
  const count = arr => {
    const mp = new Map()
    arr.forEach(x => {
      const k = (x || '').trim()
      if (!k) return
      const e = mp.get(k.toLowerCase()) || { label: k, value: 0 }
      e.value++
      mp.set(k.toLowerCase(), e)
    })
    return [...mp.values()].sort((a, b) => b.value - a.value).slice(0, 8)
  }
  const dayKeys = Array.from(new Set([...cur.map(v => v.date), ...paid.map(v => paidDate(v))])).sort()
  const days = dayKeys.map(dk => {
    const row = { date: dk, consults: cur.filter(v => v.date === dk).length, Cash: 0, UPI: 0, Card: 0 }
    paid.filter(v => paidDate(v) === dk).forEach(v => { row[v.payMode] = (row[v.payMode] || 0) + fee(v) })
    row.total = row.Cash + row.UPI + row.Card
    return row
  })
  const monthExp = expenses.filter(e => inM(e.date))
  const spentM = monthExp.reduce((s, e) => s + Number(e.amount || 0), 0)
  const expCats = Object.entries(monthExp.reduce((a, e) => ({ ...a, [e.category]: (a[e.category] || 0) + Number(e.amount || 0) }), {})).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
  return {
    spent: spentM,
    profit: revenue - spentM,
    expCats,
    monthLabel: new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    revenue,
    consults: cur.length,
    newPatients: patients.filter(p => inM(createdISO(p))).length,
    avgFee: paid.length ? Math.round(revenue / paid.length) : 0,
    pending: cur.filter(v => v.payMode === 'Pending').reduce((s, v) => s + fee(v), 0),
    depts,
    modes,
    topDx: count(cur.map(v => v.diagnosis)),
    topRx: count(cur.flatMap(v => (v.rx || []).map(x => x.medicine))),
    days
  }
}

export default function Reports() {
  const { tx } = useT()
  const { t } = useT()
  const [period, setPeriod] = useState('3m')
  const [reportMonth, setReportMonth] = useState(monthKey(new Date()))
  const [printOpen, setPrintOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
    return { key: monthKey(d), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
  }), [])
  const raw = useLiveQuery(async () => {
    const [patients, visits, expenses] = await Promise.all([db.patients.toArray(), db.visits.toArray(), db.expenses.toArray()])
    return { patients, visits, expenses }
  }, [])

  const r = useMemo(() => {
    if (!raw) return null
    const { patients, visits, expenses } = raw
    const { from, to, prevFrom, prevTo } = periodRange(period)
    const spent = (a, b) => expenses.filter(e => within(e.date, a, b)).reduce((s, e) => s + Number(e.amount || 0), 0)
    const months = monthsWindow(period)
    const deptColor = Object.fromEntries(DEPARTMENTS.map(d => [d.key, `var(--dept-${d.key.toLowerCase()})`]))

    const revenue = (a, b) => visits.filter(v => fee(v) > 0 && within(paidDate(v), a, b)).reduce((s, v) => s + fee(v), 0)
    const paidCount = (a, b) => visits.filter(v => fee(v) > 0 && within(paidDate(v), a, b)).length
    const consults = (a, b) => visits.filter(v => within(v.date, a, b))
    const newPts = (a, b) => patients.filter(p => within(createdISO(p), a, b)).length

    const cur = consults(from, to)
    const kpi = {
      revenue: revenue(from, to), prevRevenue: revenue(prevFrom, prevTo),
      consults: cur.length, prevConsults: consults(prevFrom, prevTo).length,
      newPatients: newPts(from, to), prevNew: newPts(prevFrom, prevTo),
      avgFee: paidCount(from, to) ? Math.round(revenue(from, to) / paidCount(from, to)) : 0,
      prevAvg: paidCount(prevFrom, prevTo) ? Math.round(revenue(prevFrom, prevTo) / paidCount(prevFrom, prevTo)) : 0,
      outstanding: visits.filter(v => v.payMode === 'Pending').reduce((s, v) => s + fee(v), 0),
      outstandingN: visits.filter(v => v.payMode === 'Pending' && fee(v) > 0).length,
      spent: spent(from, to),
      prevSpent: spent(prevFrom, prevTo)
    }
    kpi.profit = kpi.revenue - kpi.spent
    kpi.prevProfit = kpi.prevRevenue - kpi.prevSpent

    const revByMonth = months.map(m => ({ label: m.label, full: m.full, value: visits.filter(v => fee(v) > 0 && (paidDate(v) || '').startsWith(m.key)).reduce((s, v) => s + fee(v), 0) }))
    const expByMonth = months.map(m => expenses.filter(e => (e.date || '').startsWith(m.key)).reduce((s, e) => s + Number(e.amount || 0), 0))
    const newByMonth = months.map(m => ({ label: m.label, full: m.full, value: patients.filter(p => (createdISO(p) || '').startsWith(m.key)).length }))
    const deptSeries = DEPARTMENTS.map(d => ({ key: d.key, name: t(`dept.${d.key}`), color: deptColor[d.key], values: months.map(m => visits.filter(v => v.department === d.key && v.date.startsWith(m.key)).length) })).filter(s => s.values.some(Boolean))

    const deptRows = DEPARTMENTS.map(d => {
      const vs = cur.filter(v => v.department === d.key)
      const rev = visits.filter(v => v.department === d.key && fee(v) > 0 && within(paidDate(v), from, to)).reduce((s, v) => s + fee(v), 0)
      const paid = visits.filter(v => v.department === d.key && fee(v) > 0 && within(paidDate(v), from, to)).length
      return { key: d.key, name: t(`dept.${d.key}`), color: deptColor[d.key], consults: vs.length, revenue: rev, avg: paid ? Math.round(rev / paid) : 0, share: cur.length ? Math.round((vs.length / cur.length) * 100) : 0 }
    })

    const modes = ['Cash', 'UPI', 'Card'].map(m => ({ label: m, value: visits.filter(v => v.payMode === m && fee(v) > 0 && within(paidDate(v), from, to)).reduce((s, v) => s + fee(v), 0) }))
    const modeTotal = modes.reduce((s, m) => s + m.value, 0)

    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, value: cur.filter(v => (new Date(v.date + 'T00:00:00').getDay() + 6) % 7 === i).length }))

    const count = arr => {
      const m = new Map()
      arr.forEach(x => {
        const k = (x || '').trim()
        if (!k) return
        const key = k.toLowerCase()
        const e = m.get(key) || { label: k, value: 0 }
        e.value++
        m.set(key, e)
      })
      return [...m.values()].sort((a, b) => b.value - a.value).slice(0, 6)
    }
    const topDx = count(cur.map(v => v.diagnosis))
    const topRx = count(cur.flatMap(v => (v.rx || []).map(x => x.medicine)))

    return { from, to, months, kpi, revByMonth, expByMonth, newByMonth, deptSeries, deptRows, modes, modeTotal, wd, topDx, topRx }
  }, [raw, period, t])

  if (!r) return null
  const k = r.kpi
  const openReport = async () => {
    setProfile(await getProfile())
    setPrintOpen(true)
  }
  const busiest = [...r.wd].sort((a, b) => b.value - a.value)[0]

  return (
    <div>
      <PageHeader eyebrow={t('reports.eyebrow')} title={t('reports.title')}>
        <div className="flex items-center gap-1.5 rounded-xl border border-gold-500/15 bg-night-800/50 p-1">
          <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="rounded-lg bg-transparent px-2 py-1.5 text-xs font-semibold text-gold-200 outline-none" aria-label={tx('Monthly report')}>
            {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button onClick={openReport} className="btn-gold px-3 py-1.5 text-xs"><Printer size={14} /> {tx('Print monthly report')}</button>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-gold-500/15 bg-night-800/50 p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${period === p.key ? 'gold-fill text-ink shadow-gold' : 'text-gold-200/55 hover:text-gold-200'}`}>{tx(p.label)}</button>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi i={0} icon={IndianRupee} label={tx('Collected')} value={fmtMoney(k.revenue)}><Delta now={k.revenue} prev={k.prevRevenue} money /></Kpi>
        <Kpi i={1} icon={Wallet} label={tx('Expenses')} value={fmtMoney(k.spent)}><Delta now={k.spent} prev={k.prevSpent} money invert /></Kpi>
        <Kpi i={2} icon={PiggyBank} label={tx('Net profit')} value={fmtMoney(k.profit)}><Delta now={k.profit} prev={k.prevProfit} money /></Kpi>
        <Kpi i={3} icon={Clock} label={tx('Outstanding')} value={fmtMoney(k.outstanding)}><span className="text-[11px] text-gold-200/45">{k.outstandingN} · {tx('unpaid · all time')}</span></Kpi>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Kpi i={4} icon={Stethoscope} label={tx('Consultations')} value={k.consults}><Delta now={k.consults} prev={k.prevConsults} /></Kpi>
        <Kpi i={5} icon={UserPlus} label={tx('New patients')} value={k.newPatients}><Delta now={k.newPatients} prev={k.prevNew} /></Kpi>
        <Kpi i={6} icon={Receipt} label={tx('Avg. fee')} value={fmtMoney(k.avgFee)}><Delta now={k.avgFee} prev={k.prevAvg} money /></Kpi>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {printOpen && profile && (
          <DocPreview open={printOpen} onClose={() => setPrintOpen(false)} title={tx('Monthly report')} subtitle={monthOptions.find(o => o.key === reportMonth)?.label} sheet={<MonthlyReportDoc profile={profile} data={monthlyData(raw, reportMonth)} />} />
        )}
        <ChartCard i={0} title={tx('Revenue collected')} subtitle={tx('By month the money was received')} table={{ columns: ['Month', 'Collected'], rows: r.revByMonth.map(d => [d.full, fmtMoney(d.value)]) }}>
          <ColumnChart data={r.revByMonth} format={fmtMoney} fmtY={compactMoney} name="Revenue collected by month" />
        </ChartCard>
        <ChartCard i={1} title={tx('New patients')} subtitle={tx('Registrations per month')} table={{ columns: ['Month', 'New patients'], rows: r.newByMonth.map(d => [d.full, d.value]) }}>
          <LineChart data={r.newByMonth} format={v => `${v} new patient${v === 1 ? '' : 's'}`} fmtY={v => v} integer name="New patients by month" />
        </ChartCard>
      </div>

      {r.expByMonth.some(Boolean) && (
        <div className="mt-4">
          <ChartCard
            i={2}
            title={tx('Revenue vs expenses')}
            subtitle={tx('Money in and money out each month')}
            legend={<Legend series={[{ key: 'rev', name: tx('Collected'), color: 'var(--series-rev)' }, { key: 'exp', name: tx('Expenses'), color: 'var(--series-exp)' }]} />}
            table={{ columns: ['Month', tx('Collected'), tx('Expenses'), tx('Net profit')], rows: r.months.map((m, i) => [m.full, fmtMoney(r.revByMonth[i].value), fmtMoney(r.expByMonth[i]), fmtMoney(r.revByMonth[i].value - r.expByMonth[i])]) }}
          >
            <GroupedColumns
              labels={r.months.map(m => m.label)}
              fullLabels={r.months.map(m => m.full)}
              series={[{ key: 'rev', name: tx('Collected'), color: 'var(--series-rev)', values: r.revByMonth.map(d => d.value) }, { key: 'exp', name: tx('Expenses'), color: 'var(--series-exp)', values: r.expByMonth }]}
              format={fmtMoney}
              fmtY={compactMoney}
              name="Revenue and expenses by month"
            />
          </ChartCard>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <ChartCard
          i={2}
          className="lg:col-span-3"
          title={tx('Consultations by department')}
          subtitle={tx('Monthly mix across the clinic')}
          legend={r.deptSeries.length > 1 && <Legend series={r.deptSeries} />}
          table={{ columns: ['Month', ...r.deptSeries.map(s => s.name), 'Total'], rows: r.months.map((m, i) => [m.full, ...r.deptSeries.map(s => s.values[i]), r.deptSeries.reduce((a, s) => a + s.values[i], 0)]) }}
        >
          {r.deptSeries.length ? (
            <StackedColumns labels={r.months.map(m => m.label)} fullLabels={r.months.map(m => m.full)} series={r.deptSeries} name="Consultations by department per month" />
          ) : (
            <p className="py-16 text-center text-sm text-gold-200/40">{tx('No consultations yet')}</p>
          )}
        </ChartCard>
        <ChartCard i={3} className="lg:col-span-2" title={tx('Department performance')} subtitle={tx('Selected period')}>
          <ul className="space-y-4">
            {r.deptRows.map(d => (
              <li key={d.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gold-200"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />{d.name}</span>
                  <span className="text-xs text-gold-200/55">{d.share}% {tx('of visits')}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-night-950/60">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${d.share}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full" style={{ background: d.color }} />
                </div>
                <div className="mt-1.5 grid grid-cols-3 text-[11px] text-gold-200/50">
                  <span><span className="font-semibold text-gold-200">{d.consults}</span> {tx('visits')}</span>
                  <span className="text-center"><span className="font-semibold text-gold-200">{fmtMoney(d.revenue)}</span></span>
                  <span className="text-right">{tx('avg')} <span className="font-semibold text-gold-200">{fmtMoney(d.avg)}</span></span>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard i={4} title={tx('Payment modes')} subtitle={r.modeTotal ? `${fmtMoney(r.modeTotal)} collected` : tx('Selected period')}>
          <BarList items={r.modes.map(m => ({ ...m, sub: r.modeTotal ? `${Math.round((m.value / r.modeTotal) * 100)}%` : '' }))} format={fmtMoney} />
        </ChartCard>
        <ChartCard i={5} title={tx('Busiest days')} subtitle={busiest?.value ? `${busiest.label} is the busiest` : tx('Consultations by weekday')}>
          <ColumnChart data={r.wd} height={180} format={v => `${v} consultation${v === 1 ? '' : 's'}`} fmtY={v => v} integer name="Consultations by weekday" />
        </ChartCard>
        <ChartCard i={6} title={tx('Top diagnoses')} subtitle={tx('Selected period')}>
          <BarList items={r.topDx} />
        </ChartCard>
        <ChartCard i={7} title={tx('Top remedies')} subtitle={tx('Most prescribed')}>
          <BarList items={r.topRx} />
        </ChartCard>
      </div>
    </div>
  )
}
