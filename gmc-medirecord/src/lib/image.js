function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This file could not be read as a photo.'))
    }
    img.src = url
  })
}

function draw(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise(resolve => canvas.toBlob(b => resolve({ blob: b, w, h }), 'image/jpeg', quality))
}

export async function preparePhoto(file) {
  const img = await loadImage(file)
  const full = await draw(img, 1600, 0.84)
  const thumb = await draw(img, 420, 0.75)
  return { blob: full.blob, thumb: thumb.blob, width: full.w, height: full.h }
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

export function dataURLToBlob(dataURL) {
  const [head, body] = dataURL.split(',')
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
