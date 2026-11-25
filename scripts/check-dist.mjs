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
// The only tolerated external string is Workbox's exact documentation link inside a console warning.
const SW_DOC_LINK = 'https://bit.ly/wb-precache'
for (const name of readdirSync(DIST).filter((n) => n === 'sw.js' || /^workbox-.*\.js$/.test(n))) {
  const js = readFileSync(join(DIST, name), 'utf8').split(SW_DOC_LINK).join('')
  for (const m of js.matchAll(/url:\s*["'`]([^"'`]+)["'`]/g)) {
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(m[1])) errors.push(`${name}: non-relative precache URL ${m[1]}`)
  }
  if (/importScripts\([^)]*["'`](?:[a-z][a-z0-9+.-]*:)?\/\//i.test(js)) errors.push(`${name}: external importScripts`)
  // Any string literal starting with scheme:// or // (protocol-relative) points outside the origin.
  for (const m of js.matchAll(/["'`]((?:https?:|wss?:)?\/\/[^"'`\s]*)/gi)) errors.push(`${name}: external URL in string ${m[1]}`)
}
if (errors.length) {
  process.stdout.write(errors.join('\n') + '\n')
  process.exit(1)
}
process.stdout.write('check-dist: HTML is CSP-clean; service worker is same-origin only\n')
