const ITERATIONS = 250000

function toB64(bytes) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  return btoa(s)
}

function fromB64(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream))
  return new Uint8Array(await res.arrayBuffer())
}

const canGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptText(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  let bytes = new TextEncoder().encode(text)
  const gz = canGzip()
  if (gz) bytes = await pipe(bytes, new CompressionStream('gzip'))
  const key = await deriveKey(password, salt, ITERATIONS)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes))
  return { enc: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: ITERATIONS, gz, salt: toB64(salt), iv: toB64(iv), data: toB64(cipher) }
}

export async function decryptText(box, password) {
  const key = await deriveKey(password, fromB64(box.salt), box.iter || ITERATIONS)
  let plain
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.data)))
  } catch {
    throw new Error('Wrong backup password.')
  }
  if (box.gz) {
    if (!canGzip()) throw new Error('This browser cannot open compressed backups. Update Chrome, Edge or Safari.')
    plain = await pipe(plain, new DecompressionStream('gzip'))
  }
  return new TextDecoder().decode(plain)
}
