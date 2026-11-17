const TABLE = 'gmc_records'

export class SyncError extends Error {
  constructor(message, kind = 'server', status = 0) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

function cleanUrl(url) {
  let u = String(url || '').trim().replace(/\/+$/, '')
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u
  return u
}

async function call(base, anonKey, path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: anonKey, 'Content-Type': 'application/json' }
  headers.Authorization = 'Bearer ' + (token || anonKey)
  if (prefer) headers.Prefer = prefer
  let res
  try {
    res = await fetch(cleanUrl(base) + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new SyncError('No internet connection.', 'offline')
  }
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = (data && (data.error_description || data.msg || data.message || data.error)) || `Server error ${res.status}`
    if (res.status === 401 || res.status === 403) throw new SyncError(msg, 'auth', res.status)
    if (res.status === 404 || /gmc_records|PGRST20|relation/i.test(String(msg))) throw new SyncError('The sync table is missing. Run the setup SQL in Supabase first.', 'setup', res.status)
    throw new SyncError(msg, 'server', res.status)
  }
  return data
}

export function normaliseUrl(url) {
  return cleanUrl(url)
}

export async function signIn(url, anonKey, email, password) {
  try {
    return await call(url, anonKey, '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
  } catch (err) {
    if (err.kind === 'offline') throw err
    if (err.status === 400 || err.kind === 'auth') throw new SyncError('Email or account password is wrong.', 'login', err.status)
    throw err
  }
}

export async function refreshSession(url, anonKey, refreshToken) {
  try {
    return await call(url, anonKey, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } })
  } catch (err) {
    if (err.kind === 'offline') throw err
    throw new SyncError('Sync sign-in expired. Connect this device again.', 'login', err.status)
  }
}

export async function upsertRows(url, anonKey, token, rows) {
  if (!rows.length) return
  await call(url, anonKey, `/rest/v1/${TABLE}?on_conflict=owner,table_name,record_key`, {
    method: 'POST',
    token,
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal'
  })
}

export async function fetchMeta(url, anonKey, token) {
  const rows = await call(url, anonKey, `/rest/v1/${TABLE}?select=payload&table_name=eq._meta&record_key=eq.check&limit=1`, { token })
  return rows && rows[0] ? JSON.parse(rows[0].payload) : null
}

export async function fetchPage(url, anonKey, token, since, offset, limit) {
  const parts = [
    'select=table_name,record_key,updated_at,deleted,payload,server_ts',
    'table_name=neq._meta',
    'order=server_ts.asc,table_name.asc,record_key.asc',
    `limit=${limit}`,
    `offset=${offset}`
  ]
  if (since) parts.push('server_ts=gte.' + encodeURIComponent(since))
  return (await call(url, anonKey, `/rest/v1/${TABLE}?` + parts.join('&'), { token })) || []
}
