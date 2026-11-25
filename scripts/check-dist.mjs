// Post-build gate: no inline script/style in HTML, no third-party origins referenced by HTML.
import { readFileSync, readdirSync } from 'node:fs'
import { tokenizer } from 'acorn'
import { join } from 'node:path'

const DIST = 'dist'
const errors = []
for (const name of readdirSync(DIST).filter((n) => n.endsWith('.html'))) {
  const html = readFileSync(join(DIST, name), 'utf8')
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=/.test(m[1]) || m[2].trim()) errors.push(`${name}: inline <script>`)
  }
  if (/<style\b/i.test(html)) errors.push(`${name}: inline <style>`)
  if (/\sstyle=/i.test(html)) errors.push(`${name}: inline style attribute`)
  if (/\son[a-z]+=/i.test(html)) errors.push(`${name}: inline event handler`)
  for (const m of html.matchAll(/\b(?:src|href)=["'](https?:)?\/\/[^"']+/gi)) errors.push(`${name}: external reference ${m[0]}`)
}
// Service worker: defense in depth (at runtime /sw.js is served with the same strict CSP: script-src/connect-src).
// String values are obtained with a real JS tokenizer (acorn): escapes, line continuations and template
// literals are decoded exactly as JavaScript does — no hand-written unescaping to bypass.
const SW_DOC_LINK = 'https://bit.ly/wb-precache'
// WHATWG URL parsing skips leading C0 controls/spaces and treats backslashes as slashes.
const stripC0 = (v) => {
  let k = 0
  while (k < v.length && v.charCodeAt(k) <= 0x20) k++
  return v.slice(k)
}
// WHATWG URL parsing also removes ASCII tab/LF/CR ANYWHERE in the input.
const normalise = (v) => stripC0(v).replace(/[\t\n\r]/g, '').replace(/\\/g, '/')
// Network-capable references: '//host', 'scheme://host' or bare 'http(s):/ws(s):/ftp:' (e.g. 'https:evil.com').
// Non-URL identifiers like 'workbox:core:7.4.0' are not network schemes.
const isExternal = (v) => {
  const n = normalise(v)
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(n) || /^(https?|wss?|ftp):/i.test(n)
}

function stringTokens(js) {
  const out = []
  for (const t of tokenizer(js, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true })) {
    if (t.type.label === 'string') out.push({ value: String(t.value), start: t.start })
    else if (t.type.label === 'template' && typeof t.value === 'string') out.push({ value: t.value, start: t.start })
    // Regex literals can be turned into strings (.source): scan their pattern too (\/ unescaped).
    else if (t.type.label === 'regexp' && t.value && typeof t.value.pattern === 'string') out.push({ value: t.value.pattern.replace(/\\\//g, '/'), start: t.start })
  }
  return out
}

for (const name of readdirSync(DIST).filter((n) => n === 'sw.js' || /^workbox-.*\.js$/.test(n))) {
  const js = readFileSync(join(DIST, name), 'utf8')
  let strings
  try {
    strings = stringTokens(js)
  } catch (err) {
    errors.push(`${name}: cannot be tokenized (${err instanceof Error ? err.message : 'error'})`)
    continue
  }
  // 1) No string value may point outside the origin (doc link tolerated only as an exact, standalone value).
  for (const { value } of strings) {
    if (value === SW_DOC_LINK) continue
    if (isExternal(value)) errors.push(`${name}: external URL in string ${JSON.stringify(value)}`)
  }
  // 2) Precache entries ({url:"..."}): strict allowlist of plain relative paths (doc link not accepted here).
  for (const m of js.matchAll(/(?:\burl|["'`]url["'`])\s*:\s*(?=["'`])/g)) {
    const tok = strings.find((s) => s.start === m.index + m[0].length)
    const u = tok ? normalise(tok.value) : ''
    if (!/^[\w.-][\w./-]*$/.test(u) || u.includes('//')) errors.push(`${name}: precache URL not a plain relative path: ${tok ? tok.value : '?'}`)
  }
  // 3) importScripts: literal args must be local files; the dynamic Workbox AMD loader is allowed only when all
  //    define([...]) dependencies are local './workbox-*' modules.
  for (const m of js.matchAll(/importScripts\(([^)]*)\)/g)) {
    const argStart = m.index + 'importScripts('.length
    const lits = strings.filter((s) => s.start >= argStart && s.start < argStart + m[1].length).map((s) => s.value)
    if (lits.length === 0) {
      const deps = [...js.matchAll(/define\(\[([^\]]*)\]/g)].flatMap((d) => {
        const from = d.index + 'define(['.length
        return strings.filter((s) => s.start >= from && s.start < from + d[1].length).map((s) => s.value)
      })
      if (name !== 'sw.js' || deps.length === 0 || deps.some((d) => !/^\.\/workbox-[\w-]+$/.test(d))) errors.push(`${name}: dynamic importScripts with non-local modules: ${deps.join(', ') || m[0]}`)
    } else if (lits.some((a) => !/^\.?\/?[\w.-]+\.js$/.test(a))) errors.push(`${name}: importScripts not limited to local files: ${lits.join(', ')}`)
  }
}
if (errors.length) {
  process.stdout.write(errors.join('\n') + '\n')
  process.exit(1)
}
process.stdout.write('check-dist: HTML is CSP-clean; service worker is same-origin only\n')
