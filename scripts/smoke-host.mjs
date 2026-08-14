// Standalone smoke test for voicelens host half (no real key required).
// Exercises: module import, tool registration, provider selection errors,
// and the OpenAI-compatible request construction via a mocked fetch.
import { name, inject, apply } from '../dsh/index.js'

let captured = null
const tools = {
  register(def) {
    captured = def
    return () => {}
  },
}
const ctx = {
  get(k) {
    return k === 'tools' ? tools : undefined
  },
  on() {},
  effect() {},
}

apply(ctx, {})
if (!captured || captured.name !== 'transcribe_audio') {
  throw new Error('tool not registered: ' + JSON.stringify(captured?.name))
}
console.log('✓ tool registered:', captured.name)
console.log('✓ inject:', JSON.stringify(inject), '| name:', name)

// 1. No provider configured -> clear error.
try {
  await captured.execute({ path: 'x.wav' }, { signal: undefined })
  console.log('✗ expected error, got none')
} catch (e) {
  console.log('✓ no-provider error path:', String(e.message).split('\n')[0])
}

// 2. OpenAI request construction with a mocked fetch.
const seen = { url: null, headers: null, formParts: null }
globalThis.fetch = async (url, opts) => {
  if (opts?.method === 'POST') {
    seen.url = url
    seen.headers = opts.headers
    const parts = {}
    for (const [k, v] of opts.body.entries()) parts[k] = v instanceof Blob ? `Blob(${v.type},${v.size})` : String(v)
    seen.formParts = parts
    return new Response(JSON.stringify({ text: '你好，这是测试转写', language: 'zh' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  // GET: audio download
  return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/mp4' } })
}

process.env.VOICELENS_PROVIDER = 'openai'
process.env.VOICELENS_OPENAI_API_KEY = 'sk-test'
process.env.VOICELENS_OPENAI_BASE_URL = 'https://api.example.com/v1'
process.env.VOICELENS_OPENAI_MODEL = 'whisper-1'

const result = await captured.execute({ url: 'https://cdn.example.com/a.m4a' }, { signal: undefined })
console.log('✓ transcribe result:', JSON.stringify(result))
console.log('✓ fetch url:', seen.url)
console.log('✓ auth header present:', String(seen.headers?.Authorization).startsWith('Bearer sk-test'))
console.log('✓ form parts:', JSON.stringify(seen.formParts))

if (result.text !== '你好，这是测试转写' || result.provider !== 'openai') {
  throw new Error('unexpected result')
}
console.log('\nALL HOST SMOKE TESTS PASSED')
