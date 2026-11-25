// Node test env: provide the browser's native XML parser/serializer (what kdbxweb uses in browsers)
// without turning the whole environment into jsdom (cross-realm ArrayBuffer issues).
import { JSDOM } from 'jsdom'

const { window } = new JSDOM('')
Object.assign(globalThis, { DOMParser: window.DOMParser, XMLSerializer: window.XMLSerializer })
