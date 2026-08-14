// voicelens core engine — ASR providers behind one interface (harness-agnostic).
// Providers: openai (OpenAI-compatible /audio/transcriptions), groq (same wire,
// free tier), whisper-local (whisper.cpp CLI subprocess, zero key).
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { spawn } from 'node:child_process'

const MEDIA_EXT = {
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/flac': '.flac',
}

const MIME_BY_EXT = {
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
}

/** Fetch a remote audio file into bytes + metadata. */
export async function loadUrl(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`voicelens: download failed (HTTP ${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const mime = res.headers.get('content-type')?.split(';')[0].trim() || undefined
  return { bytes, mime, filename: basename(new URL(url).pathname) || 'audio' }
}

/** Read a local audio file into bytes + metadata. */
export async function loadPath(path) {
  const bytes = new Uint8Array(await readFile(path))
  const ext = extnameLower(path)
  return { bytes, mime: MIME_BY_EXT[ext], filename: basename(path) }
}

/** Transcribe one audio source through the selected provider. */
export async function transcribe(provider, source, config, signal) {
  if (provider === 'openai' || provider === 'groq') {
    return transcribeOpenAI(provider, source, config, signal)
  }
  if (provider === 'whisper-local') {
    return transcribeWhisperLocal(source, config, signal)
  }
  throw new Error(`voicelens: unknown provider "${provider}"`)
}

async function transcribeOpenAI(provider, source, config, signal) {
  const baseUrl = provider === 'groq' ? 'https://api.groq.com/openai/v1' : (config.baseUrl || 'https://api.openai.com/v1')
  const apiKey = provider === 'groq' ? config.groqApiKey : config.apiKey
  if (!apiKey) {
    throw new Error(
      `voicelens: provider "${provider}" needs an API key (${provider === 'groq' ? 'VOICELENS_GROQ_API_KEY' : 'VOICELENS_OPENAI_API_KEY'})`,
    )
  }
  const model = config.model || (provider === 'groq' ? 'whisper-large-v3' : 'whisper-1')
  const mime = source.mime || 'audio/webm'
  const form = new FormData()
  form.append('file', new Blob([source.bytes], { type: mime }), source.filename || `audio${MEDIA_EXT[mime] || '.webm'}`)
  form.append('model', model)
  if (config.lang) form.append('language', config.lang)

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    throw new Error(`voicelens: ${provider} transcription failed (HTTP ${res.status}): ${body}`)
  }
  const data = await res.json()
  return { text: data?.text ?? '', language: data?.language ?? config.lang ?? undefined, provider }
}

async function transcribeWhisperLocal(source, config, signal) {
  const bin = config.whisperCpp
  if (!bin) throw new Error('voicelens: whisper-local needs VOICELENS_WHISPER_CPP (path to whisper.cpp main)')
  const ext = MEDIA_EXT[source.mime] || extnameLower(source.filename) || '.wav'
  const dir = await mkdir(join(tmpdir(), 'voicelens-'), { recursive: true })
  const file = join(dir, `audio${ext}`)
  await writeFile(file, source.bytes, { mode: 0o600 })
  const args = ['-m', config.whisperModel || 'models/ggml-base.bin', '-f', file, '--output-txt', '--output-file', join(dir, 'out')]
  if (config.lang) args.push('-l', config.lang)
  try {
    const { code, stderr } = await run(bin, args, signal)
    if (code !== 0) throw new Error(`whisper.cpp failed (exit ${code}): ${stderr.slice(0, 300)}`)
    const text = await readFile(join(dir, 'out.txt'), 'utf8')
    return { text: text.trim(), language: config.lang || undefined, provider: 'whisper-local' }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

function run(command, args, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], signal })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stderr }))
  })
}

function extnameLower(p) {
  const dot = p.lastIndexOf('.')
  return dot === -1 ? '' : p.slice(dot).toLowerCase()
}

/** Render a transcript result as the model-facing text block. */
export function renderTranscript(value) {
  const lines = [value.text?.trim() || '(empty transcript)']
  if (value.language) lines.push('', `Language: ${value.language}`)
  lines.push('', `Provider: ${value.provider}`)
  return lines.join('\n')
}
