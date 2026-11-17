function toB64(bytes) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  return btoa(s)
}

function fromB64(text) {
  const bin = atob(text || '')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function post(name, body) {
  let res
  try {
    res = await fetch(`./api/pg/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  } catch {
    return { ok: false, offline: true, error: 'The MediRecord server on this laptop is not running. Restart the laptop, or run “npm run clinic” in the project folder.' }
  }
  try {
    return await res.json()
  } catch {
    return { ok: false, error: `Server error ${res.status}` }
  }
}

const serverBridge = {
  status: () => post('status'),
  connect: form => post('connect', { form }),
  forget: () => post('forget'),
  push: rows => post('push', { rows: rows.map(r => ({ ...r, files: (r.files || []).map(f => ({ ...f, bytes: toB64(f.bytes) })) })) }),
  pull: async (since, offset, limit) => {
    const r = await post('pull', { since, offset, limit })
    if (r && r.ok) r.data = r.data.map(row => ({ ...row, files: (row.files || []).map(f => ({ ...f, bytes: fromB64(f.bytes) })) }))
    return r
  }
}

export const SERVER_PORT = '4747'

function onLocalServer() {
  const { hostname, port } = window.location
  return (hostname === 'localhost' || hostname === '127.0.0.1') && port === SERVER_PORT
}

export function runtimeKind() {
  if (typeof window === 'undefined') return 'web'
  if (window.gmcDesktop && window.gmcDesktop.pg) return 'desktop'
  if (window.gmcServer || onLocalServer()) return 'server'
  return 'web'
}

export function pgBridge() {
  const kind = runtimeKind()
  if (kind === 'desktop') return window.gmcDesktop.pg
  if (kind === 'server') return serverBridge
  return null
}
