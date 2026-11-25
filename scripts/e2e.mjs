// End-to-end check of the BUILT app (dist/) served with the exact headers from vercel.json.
// Asserts: app works under the CSP, no HIBP request while typing, only a 5-char prefix on blur,
// no request to any other origin, storage holds no plaintext.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const DIST = 'dist'
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
const headers = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]))
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST) || !existsSync(file) || url.pathname === '/') file = join(DIST, 'index.html')
  res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(4175, r))

const fail = (msg) => {
  process.stdout.write(`E2E FAIL: ${msg}\n`)
  process.exitCode = 1
}
const browser = await chromium.launch()
try {
  const page = await (await browser.newContext()).newPage()
  const external = []
  const hibp = []
  const cspErrors = []
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspErrors.push(m.text())
  })
  page.on('pageerror', (e) => cspErrors.push(String(e)))
  await page.route('**/*', (route) => {
    const u = route.request().url()
    if (u.startsWith('http://localhost:4175/')) return route.continue()
    if (u.startsWith('https://api.pwnedpasswords.com/range/')) {
      hibp.push({ url: u, headers: route.request().headers(), body: route.request().postData() })
      return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: 'AAAAA:0\n' })
    }
    external.push(u)
    return route.abort()
  })

  await page.goto('http://localhost:4175/')
  await page.getByRole('button', { name: /Créer un coffre/ }).click()
  const master = 'Correct-Horse-Battery-42'
  await page.getByLabel('Mot de passe maître').pressSequentially(master, { delay: 120 })
  await page.waitForTimeout(1500)
  if (hibp.length !== 0) fail(`HIBP queried while typing (${hibp.length} requests)`)
  await page.getByLabel('Confirmer le mot de passe').click() // blur → one lookup
  await page.getByLabel('Confirmer le mot de passe').fill(master)
  await page.waitForTimeout(800)
  if (hibp.length !== 1) fail(`expected exactly 1 HIBP request after blur, got ${hibp.length}`)
  await page.locator('form button[type=submit]').click()
  await page.getByRole('button', { name: /Nouvelle entrée|Ajouter/ }).first().waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: /Nouvelle entrée|Ajouter/ }).first().click()
  await page.getByLabel('Titre').fill('E2E entry')
  await page.getByLabel('Mot de passe', { exact: true }).fill('entry-secret-XYZ')
  await page.locator('form button[type=submit]').click()
  await page.getByText('E2E entry').first().waitFor()

  const storage = await page.evaluate(async () => {
    const ls = JSON.stringify(localStorage) + JSON.stringify(sessionStorage)
    const dbs = await indexedDB.databases()
    return { ls, dbs: dbs.map((d) => d.name), title: document.title, href: location.href }
  })
  for (const secret of [master, 'entry-secret-XYZ']) {
    if (storage.ls.includes(secret) || storage.title.includes(secret) || storage.href.includes(secret)) fail(`secret leaked to storage/title/url`)
  }
  for (const r of hibp) {
    if (!/\/range\/[0-9A-F]{5}$/.test(r.url)) fail(`bad HIBP URL ${r.url}`)
    if (r.body) fail('HIBP request has a body')
    if (r.headers['add-padding'] !== 'true') fail('missing Add-Padding header')
    if (JSON.stringify(r).includes(master) || JSON.stringify(r).includes('entry-secret-XYZ')) fail('secret in HIBP request')
  }
  if (external.length) fail(`requests to other origins: ${external.join(', ')}`)
  if (cspErrors.length) fail(`CSP/page errors: ${cspErrors.join(' | ')}`)
  if (!process.exitCode) process.stdout.write(`e2e: OK (HIBP requests: ${hibp.length}, external: 0, CSP violations: 0)\n`)
} finally {
  await browser.close()
  server.close()
}
