const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

let loading = null

const ALIASES = {
  headache: ['head', 'pain'],
  headaches: ['head', 'pain'],
  migraine: ['head', 'pain'],
  backache: ['back', 'pain'],
  stomachache: ['stomach', 'pain'],
  bellyache: ['abdomen', 'pain'],
  toothache: ['teeth', 'pain'],
  earache: ['ear', 'pain'],
  sorethroat: ['throat', 'pain'],
  insomnia: ['sleeplessness'],
  constipation: ['constipation'],
  diarrhoea: ['diarrhea'],
  sweat: ['perspiration'],
  sweating: ['perspiration'],
  fever: ['fever'],
  anger: ['anger'],
  angry: ['anger'],
  sad: ['sadness'],
  depression: ['sadness'],
  worry: ['anxiety'],
  thirsty: ['thirst'],
  itch: ['itching'],
  vomit: ['vomiting'],
  dizziness: ['vertigo'],
  giddiness: ['vertigo']
}

function terms(query) {
  const out = []
  for (const w of String(query || '').toLowerCase().split(/[\s,]+/).filter(Boolean)) {
    for (const t of ALIASES[w] || [w]) if (!out.includes(t)) out.push(t)
  }
  return out
}

function decode(code, remedies) {
  const out = []
  for (let i = 0; i + 2 < code.length; i += 3) {
    const idx = DIGITS.indexOf(code[i]) * 36 + DIGITS.indexOf(code[i + 1])
    const r = remedies[idx]
    if (r) out.push({ idx, abbrev: r[0], name: r[1], grade: Number(code[i + 2]) })
  }
  return out
}

function build(text) {
  const lines = text.split('\n')
  const head = JSON.parse(lines[0])
  const n = lines.length - 1
  const parent = new Int32Array(n)
  const leaf = new Array(n)
  const codes = new Array(n)
  const children = Array.from({ length: n }, () => [])
  const chapters = []
  for (let i = 0; i < n; i++) {
    const parts = lines[i + 1].split('\t')
    parent[i] = parts[0] === '' ? -1 : Number(parts[0])
    leaf[i] = parts[1] || ''
    codes[i] = parts[2] || ''
  }
  for (let i = 0; i < n; i++) {
    if (parent[i] >= 0) children[parent[i]].push(i)
    else chapters.push(i)
  }
  const byText = (a, b) => leaf[a].localeCompare(leaf[b], 'en', { sensitivity: 'base' })
  chapters.sort(byText)
  children.forEach(list => list.sort(byText))
  const chapterOf = new Int32Array(n)
  const path = new Array(n)
  const lower = new Array(n)
  const order = []
  const walk = (i, chapter, prefix) => {
    chapterOf[i] = chapter
    path[i] = prefix ? `${prefix}, ${leaf[i]}` : leaf[i]
    lower[i] = path[i].toLowerCase()
    order.push(i)
    for (const c of children[i]) walk(c, chapter, path[i])
  }
  for (const c of chapters) walk(c, c, '')
  const counts = new Int32Array(n)
  for (let i = 0; i < n; i++) counts[i] = Math.floor(codes[i].length / 3)

  const rubric = i => ({ id: i, path: path[i], leaf: leaf[i], chapter: leaf[chapterOf[i]], parent: parent[i], count: counts[i], children: children[i].length })

  return {
    info: { name: head.name, author: head.author, licence: head.licence, rubrics: n, remedies: head.remedies.length },
    chapters: chapters.map(rubric),
    rubric,
    remedies: id => decode(codes[id], head.remedies),
    children: id => children[id].map(rubric),
    trail: id => {
      const out = []
      for (let i = id; i >= 0; i = parent[i]) out.unshift(rubric(i))
      return out
    },
    search(query, chapter, limit = 200) {
      const words = terms(query)
      if (!words.length) return { items: [], total: 0 }
      const items = []
      let total = 0
      for (const i of order) {
        if (chapter >= 0 && chapterOf[i] !== chapter) continue
        const p = lower[i]
        let ok = true
        for (const w of words) {
          if (!p.includes(w)) {
            ok = false
            break
          }
        }
        if (!ok) continue
        total++
        if (items.length < limit) items.push(rubric(i))
      }
      return { items, total }
    },
    findByPath(text) {
      const target = String(text || '').toLowerCase()
      for (let i = 0; i < n; i++) if (lower[i] === target) return i
      return -1
    }
  }
}

export function loadRepertory() {
  if (!loading) {
    loading = fetch('./repertory/publicum.txt')
      .then(res => {
        if (!res.ok) throw new Error('Repertory data could not be loaded.')
        return res.text()
      })
      .then(build)
      .catch(err => {
        loading = null
        throw err
      })
  }
  return loading
}

export function repertorise(rep, picked) {
  const totals = new Map()
  picked.forEach((p, col) => {
    for (const r of rep.remedies(p.id)) {
      let t = totals.get(r.idx)
      if (!t) {
        t = { idx: r.idx, abbrev: r.abbrev, name: r.name, score: 0, count: 0, grades: new Array(picked.length).fill(0) }
        totals.set(r.idx, t)
      }
      t.score += r.grade * (p.intensity || 1)
      t.count += 1
      t.grades[col] = r.grade
    }
  })
  return [...totals.values()]
}

export function sortResults(list, by) {
  const copy = [...list]
  if (by === 'score') copy.sort((a, b) => b.score - a.score || b.count - a.count || a.abbrev.localeCompare(b.abbrev))
  else copy.sort((a, b) => b.count - a.count || b.score - a.score || a.abbrev.localeCompare(b.abbrev))
  return copy
}
