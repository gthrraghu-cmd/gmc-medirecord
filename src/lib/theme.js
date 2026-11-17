const KEY = 'gmc-theme'
const media = () => window.matchMedia?.('(prefers-color-scheme: light)')

export function getThemePref() {
  try {
    return localStorage.getItem(KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

export function resolveTheme(pref) {
  if (pref === 'system') return media()?.matches ? 'light' : 'dark'
  return pref === 'light' ? 'light' : 'dark'
}

export function applyTheme(pref = getThemePref()) {
  const t = resolveTheme(pref)
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'light' ? '#f8f3ea' : '#1c0630')
  return t
}

export function setThemePref(pref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {}
  applyTheme(pref)
  window.dispatchEvent(new CustomEvent('gmc-theme', { detail: pref }))
}

export function watchSystemTheme() {
  const m = media()
  if (!m) return () => {}
  const on = () => getThemePref() === 'system' && applyTheme('system')
  m.addEventListener?.('change', on)
  return () => m.removeEventListener?.('change', on)
}
