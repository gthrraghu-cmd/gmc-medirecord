export function todayISO() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtMoney(n) {
  if (n === '' || n === null || n === undefined || isNaN(Number(n))) return '—'
  const v = Number(n)
  return (v < 0 ? '−₹' : '₹') + Math.abs(v).toLocaleString('en-IN')
}

export function fmtTime(hhmm) {
  if (!hhmm) return 'Anytime'
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export const TIME_SLOTS = (() => {
  const out = []
  for (let m = 8 * 60; m <= 21 * 60; m += 15) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  return out
})()

export function weekStart(iso) {
  const d = new Date(iso + 'T00:00:00')
  const shift = (d.getDay() + 6) % 7
  return addDaysISO(iso, -shift)
}

export function weekDays(iso) {
  const start = weekStart(iso)
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
}

export function ageFrom(p) {
  if (p.dob) {
    const b = new Date(p.dob + 'T00:00:00')
    const n = new Date()
    let a = n.getFullYear() - b.getFullYear()
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
    return a
  }
  return p.age || ''
}

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '·'
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
