// Gate: rejects forbidden patterns in source & tests (any, ts-ignore, eslint-disable, .skip, empty catch, dangerous sinks).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src', 'tests', 'scripts']
const RULES = [
  [/\bany\b(?=\s*[>,)\];|=])|:\s*any\b|<any>|as\s+any\b/, 'explicit any'],
  [/@ts-ignore|@ts-nocheck|@ts-expect-error/, 'ts suppression'],
  [/eslint-disable|oxlint-disable/, 'lint suppression'],
  [/\b(?:it|test|describe)\.(?:skip|only|todo)\b|\bx(?:it|describe)\(/, 'skipped/focused test'],
  [/catch\s*(?:\([^)]*\))?\s*\{\s*\}/, 'empty catch'],
  [/dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\(|\beval\(|new Function\(/, 'dangerous sink'],
  [/console\.(?:log|debug|info|warn|error)\(/, 'console logging'],
]
const SELF = 'scripts/check-forbidden.mjs'

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) files.push(p)
  }
}
for (const r of ROOTS) walk(r)

let bad = 0
for (const f of files) {
  if (f === SELF) continue
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const [re, label] of RULES) {
      if (re.test(line)) {
        bad++
        process.stdout.write(`${f}:${i + 1}: ${label}: ${line.trim()}\n`)
      }
    }
  })
}
if (bad) {
  process.stdout.write(`\n${bad} forbidden pattern(s)\n`)
  process.exit(1)
}
process.stdout.write(`check-forbidden: ${files.length} files clean\n`)
