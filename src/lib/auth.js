import { getSetting, setSetting } from './db.js'

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hasPin() {
  return Boolean(await getSetting('pinHash'))
}

export async function setPin(pin) {
  const salt = randomSalt()
  await setSetting('pinSalt', salt)
  await setSetting('pinHash', await sha256(salt + ':' + pin))
}

export async function verifyPin(pin) {
  const salt = await getSetting('pinSalt', '')
  const hash = await getSetting('pinHash')
  return hash === (await sha256(salt + ':' + pin))
}
