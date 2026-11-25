// End-to-end check of the BUILT app (dist/) served with the exact headers from vercel.json.
// Asserts: app works under the CSP, no HIBP request while typing, only a 5-char prefix on blur,
// no request to any other origin, storage holds no plaintext.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage()
  // Headless has no file picker UI: exercise the download fallback (Firefox/Safari path).
  await page.addInitScript(() => {
    delete window.showSaveFilePicker
    delete window.showOpenFilePicker
  })
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
  // "Save now" is checked by default on creation: wait for that first download (empty vault).
  const createDownload = page.waitForEvent('download', { timeout: 30000 })
  await page.locator('form button[type=submit]').click()
  await createDownload
  await page.getByRole('button', { name: /Nouvelle entrée|Ajouter/ }).first().waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: /Nouvelle entrée|Ajouter/ }).first().click()
  await page.getByLabel('Titre').fill('E2E entry')
  await page.getByLabel('Mot de passe', { exact: true }).fill('entry-secret-XYZ')
  await page.locator('form button[type=submit]').click()
  await page.getByText('E2E entry').first().waitFor()
  // Save (download fallback in headless) so the encrypted copy lands in IndexedDB.
  const download = page.waitForEvent('download', { timeout: 20000 })
  await page.keyboard.press('Control+s')
  const tmp = mkdtempSync(join(tmpdir(), 'keyhold-e2e-'))
  const savedPath = join(tmp, 'saved.kdbx')
  await (await download).saveAs(savedPath)
  await page.waitForTimeout(500)

  const storage = await page.evaluate(async () => {
    const ls = JSON.stringify(localStorage) + JSON.stringify(sessionStorage)
    const dbs = await indexedDB.databases()
    // Every value stored in IndexedDB: must be KDBX-encrypted bytes, never plaintext.
    const idb = await new Promise((resolve) => {
      const req = indexedDB.open('keyhold')
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('vaults')) return resolve([])
        const all = db.transaction('vaults').objectStore('vaults').getAll()
        all.onsuccess = () => resolve(all.result.map((v) => {
          const u8 = new Uint8Array(v.encrypted)
          return { sig: Array.from(u8.slice(0, 4), (x) => x.toString(16).padStart(2, '0')).join(''), text: new TextDecoder('latin1').decode(u8) + JSON.stringify({ ...v, encrypted: null, handle: null }) }
        }))
      }
      req.onerror = () => resolve([])
    })
    return { ls, idb, dbs: dbs.map((d) => d.name), title: document.title, href: location.href }
  })
  for (const rec of storage.idb) {
    if (rec.sig !== '03d9a29a') fail(`IndexedDB record is not a KDBX container (${rec.sig})`)
    for (const secret of [master, 'entry-secret-XYZ', 'E2E entry']) if (rec.text.includes(secret)) fail('plaintext in IndexedDB')
  }
  for (const secret of [master, 'entry-secret-XYZ']) {
    if (storage.ls.includes(secret) || storage.title.includes(secret) || storage.href.includes(secret)) fail(`secret leaked to storage/title/url`)
  }
  for (const r of hibp) {
    if (!/\/range\/[0-9A-F]{5}$/.test(r.url)) fail(`bad HIBP URL ${r.url}`)
    if (r.body) fail('HIBP request has a body')
    if (r.headers['add-padding'] !== 'true') fail('missing Add-Padding header')
    if (JSON.stringify(r).includes(master) || JSON.stringify(r).includes('entry-secret-XYZ')) fail('secret in HIBP request')
  }
  // ---- Phase 2: real round-trip through the downloaded file, in a FRESH browser profile ----
  {
    const ctx2 = await browser.newContext()
    const p2 = await ctx2.newPage()
    await p2.addInitScript(() => {
      delete window.showSaveFilePicker
      delete window.showOpenFilePicker
    })
    await p2.route('**/*', (route) => (route.request().url().startsWith('http://localhost:4175/') ? route.continue() : route.abort()))
    await p2.goto('http://localhost:4175/')
    const chooser = p2.waitForEvent('filechooser')
    await p2.getByRole('button', { name: /Ouvrir un fichier/ }).click()
    await (await chooser).setFiles(savedPath)
    await p2.getByLabel('Mot de passe maître').fill('wrong-password')
    await p2.locator('form button[type=submit]').click()
    await p2.getByText(/incorrect/i).first().waitFor({ timeout: 20000 }).catch(() => fail('wrong password: no clean error'))
    await p2.getByLabel('Mot de passe maître').fill(master)
    await p2.locator('form button[type=submit]').click()
    await p2.getByText('E2E entry').first().waitFor({ timeout: 20000 }).catch(async () => { await p2.screenshot({ path: join(tmp, 'fail.png') }); fail('downloaded file did not reopen with its entry: ' + (await p2.locator('body').innerText()).slice(0, 400)) })
    await ctx2.close()
  }

  // ---- Phase 3: auto-lock with unsaved changes -> encrypted recovery copy -> unlock -> download save ----
  const idbRecords = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('keyhold')
          req.onsuccess = () => {
            const t = req.result.transaction('vaults')
            const out = []
            const cur = t.objectStore('vaults').openCursor()
            cur.onsuccess = () => {
              const c = cur.result
              if (!c) return resolve(out)
              out.push({ key: String(c.key), pending: c.value.pendingChanges === true, bytes: Array.from(new Uint8Array(c.value.encrypted)) })
              c.continue()
            }
          }
        }),
    )
  {
    await page.getByRole('button', { name: /Nouvelle entrée|Ajouter/ }).first().click()
    await page.getByLabel('Titre').fill('Recovery entry')
    await page.locator('form button[type=submit]').click()
    await page.getByText('Recovery entry').first().waitFor()
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    })
    await page.getByLabel('Mot de passe maître').waitFor({ timeout: 20000 })
    await page.waitForTimeout(500)
    const pending = (await idbRecords()).filter((r) => r.pending)
    if (pending.length !== 1) fail(`expected 1 recovery copy after auto-lock, got ${pending.length}`)
    else if (pending[0].bytes.slice(0, 4).map((x) => x.toString(16).padStart(2, '0')).join('') !== '03d9a29a') fail('recovery copy is not KDBX')
    await page.getByLabel('Mot de passe maître').fill(master)
    await page.locator('form button[type=submit]').click()
    await page.getByText('Recovery entry').first().waitFor({ timeout: 20000 }).catch(() => fail('recovered changes missing after unlock'))
    const dl2 = page.waitForEvent('download', { timeout: 20000 })
    await page.keyboard.press('Control+s')
    const saved2 = join(tmp, 'saved2.kdbx')
    await (await dl2).saveAs(saved2)
    await page.waitForTimeout(800)
    const after = (await idbRecords()).filter((r) => r.pending)
    const downloaded = Array.from(readFileSync(saved2))
    if (after.length !== 1) fail(`download save must keep the recovery copy (got ${after.length})`)
    else if (JSON.stringify(after[0].bytes) !== JSON.stringify(downloaded)) fail('recovery copy not refreshed with the downloaded bytes')
  }

  if (storage.idb.length !== 1) fail(`expected 1 encrypted IndexedDB record, got ${storage.idb.length}`)
  if (external.length) fail(`requests to other origins: ${external.join(', ')}`)
  if (cspErrors.length) fail(`CSP/page errors: ${cspErrors.join(' | ')}`)
  if (!process.exitCode) process.stdout.write(`e2e: OK (HIBP: prefix-only, ${hibp.length} req, none while typing; IndexedDB: encrypted only; download round-trip + wrong password OK; auto-lock recovery + refresh OK; external: 0; CSP violations: 0)\n`)
} finally {
  await browser.close()
  server.close()
}
