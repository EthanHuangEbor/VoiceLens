// Smoke test for the /voicelens/transcribe HTTP route (Firefox fallback).
import { apply } from '../dsh/index.js'

let tool = null
let route = null
const ctx = {
  get(k) {
    if (k === 'tools') return { register: (d) => (tool = d, () => {}) }
    if (k === 'webServer') return { register: (r) => (route = r, () => {}) }
    return undefined
  },
}

apply(ctx, {})
if (!tool || tool.name !== 'transcribe_audio') throw new Error('tool not registered')
if (!route || route.path !== '/voicelens/transcribe') throw new Error('route not registered: ' + JSON.stringify(route))
console.log('✓ tool registered:', tool.name)
console.log('✓ route registered:', route.kind, route.path)

process.env.VOICELENS_PROVIDER = 'groq'
process.env.VOICELENS_GROQ_API_KEY = 'gsk-test'
globalThis.fetch = async (url, opts) => {
  if (opts?.method !== 'POST') throw new Error('expected POST, got ' + opts?.method)
  if (!(opts.body instanceof FormData)) throw new Error('expected FormData body')
  return new Response(JSON.stringify({ text: '这是路由转写结果', language: 'zh' }), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Mock req (async-iterable body) and res (capture status/body).
const req = {
  method: 'POST',
  headers: { 'content-type': 'audio/webm', 'x-voicelens-lang': 'zh' },
  async *[Symbol.asyncIterator]() { yield Buffer.from([1, 2, 3, 4]) },
}
let status = 0
let body = ''
const res = { writeHead: (s) => (status = s), end: (b) => (body = b) }

await route.handler(req, res)
const parsed = JSON.parse(body)
console.log('✓ status:', status)
console.log('✓ result text:', parsed.text, '| provider:', parsed.provider)
if (status !== 200 || parsed.text !== '这是路由转写结果') throw new Error('route failed')

// 405 for non-POST
status = 0
await route.handler({ method: 'GET', headers: {} }, res)
if (status !== 405) throw new Error('expected 405, got ' + status)
console.log('✓ non-POST returns 405')

console.log('\nALL ROUTE SMOKE TESTS PASSED')
