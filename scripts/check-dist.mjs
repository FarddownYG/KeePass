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
// Service worker: precache only same-origin relative URLs, no external script imports, no external origins.
for (const name of readdirSync(DIST).filter((n) => n === 'sw.js' || /^workbox-.*\.js$/.test(n))) {
  const js = readFileSync(join(DIST, name), 'utf8')
  for (const m of js.matchAll(/url:\s*"([^"]+)"/g)) if (/^[a-z]+:\/\//i.test(m[1])) errors.push(`${name}: external precache URL ${m[1]}`)
  if (/importScripts\(\s*["']https?:/.test(js)) errors.push(`${name}: external importScripts`)
  // Documentation links inside Workbox warning strings are not requests.
  const origins = [...js.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]).filter((h) => h !== 'bit.ly')
  for (const o of new Set(origins)) errors.push(`${name}: references external origin ${o}`)
}
if (errors.length) {
  process.stdout.write(errors.join('\n') + '\n')
  process.exit(1)
}
process.stdout.write('check-dist: HTML is CSP-clean; service worker is same-origin only\n')
