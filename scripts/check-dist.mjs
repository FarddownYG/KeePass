// Post-build gate: no inline script/style in HTML, no third-party origins referenced by HTML.
import { readFileSync, readdirSync } from 'node:fs'
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
// Service worker: defense in depth (at runtime /sw.js is served with the same CSP: script-src/connect-src).
// - importScripts: allowlist of local file names only;
// - every string literal is normalised (leading spaces, \/ escapes, backslashes = slashes, as URL parsers do)
//   and must not be absolute or protocol-relative; Workbox's doc link is tolerated only as the WHOLE string.
const SW_DOC_LINK = 'https://bit.ly/wb-precache'
// URL parsers also skip leading C0 control characters: strip them (charCode <= 0x20) without a control-char regex.
const stripC0 = (v) => {
  let k = 0
  while (k < v.length && v.charCodeAt(k) <= 0x20) k++
  return v.slice(k)
}
const normalise = (lit) => stripC0(lit.replace(/\\\//g, '/').replace(/\\\\/g, '/').replace(/\\/g, '/'))
for (const name of readdirSync(DIST).filter((n) => n === 'sw.js' || /^workbox-.*\.js$/.test(n))) {
  const js = readFileSync(join(DIST, name), 'utf8')
  for (const m of js.matchAll(/importScripts\(([^)]*)\)/g)) {
    const args = [...m[1].matchAll(/["'`]([^"'`]*)["'`]/g)].map((a) => a[1])
    if (args.length === 0) {
      // Workbox AMD loader: importScripts(i) where i = new URL(dep + '.js', swUrl). Allowed only if every
      // define([...]) dependency is a local relative './workbox-*' module (so i is always same-origin).
      const deps = [...js.matchAll(/define\(\[([^\]]*)\]/g)].flatMap((d) => [...d[1].matchAll(/["'`]([^"'`]*)["'`]/g)].map((x) => x[1]))
      if (name !== 'sw.js' || deps.length === 0 || deps.some((d) => !/^\.\/workbox-[\w-]+$/.test(d))) errors.push(`${name}: dynamic importScripts with non-local modules: ${deps.join(', ') || m[0]}`)
    } else if (args.some((a) => !/^\.?\/?[\w.-]+\.js$/.test(a))) errors.push(`${name}: importScripts not limited to local files: ${m[0]}`)
  }
  for (const m of js.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const raw = m[2]
    if (raw === SW_DOC_LINK) continue // exact Workbox documentation link in a warning text, not a request
    const v = normalise(raw)
    if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(v) || /^(https?|wss?|ftp|data|blob):/i.test(v)) errors.push(`${name}: external URL in string ${raw}`)
  }
}
if (errors.length) {
  process.stdout.write(errors.join('\n') + '\n')
  process.exit(1)
}
process.stdout.write('check-dist: HTML is CSP-clean; service worker is same-origin only\n')
