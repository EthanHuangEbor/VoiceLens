// voicelens — DeepSeek Harness (dsh) host plugin.
//
// Faithful port of the @liustack/modlens integration shape, applied to speech:
// a model-callable `transcribe_audio` tool backed by a small, configurable ASR
// engine. dsh has no audio message pipeline (the `attachments` service is
// image-only and `ModelModality` is text|image), so there is no audio block to
// rewrite and no audio modality to unlock — the voice intake lives in the
// client half (mic button → browser speech), while this host half gives the
// MODEL a way to transcribe any audio file/URL it encounters.
//
// Config (layered): process env VOICELENS_*  >  ~/.voicelens/config.json  >  defaults.
// Providers: openai (OpenAI-compatible /audio/transcriptions), groq (same wire,
// free tier), whisper-local (whisper.cpp CLI subprocess, zero key).

import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { spawn } from 'node:child_process'

export const name = 'voicelens'
export const inject = ['tools']

const CONFIG_PATH = join(homedir(), '.voicelens', 'config.json')

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

async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function envConfig() {
  return {
    provider: process.env.VOICELENS_PROVIDER,
    lang: process.env.VOICELENS_LANG,
    baseUrl: process.env.VOICELENS_OPENAI_BASE_URL,
    apiKey: process.env.VOICELENS_OPENAI_API_KEY,
    model: process.env.VOICELENS_OPENAI_MODEL,
    groqApiKey: process.env.VOICELENS_GROQ_API_KEY,
    whisperCpp: process.env.VOICELENS_WHISPER_CPP,
  }
}

function pickProvider(config) {
  const c = { ...envConfig(), ...config }
  const provider = c.provider
  if (provider) return provider
  if (c.apiKey && c.baseUrl) return 'openai'
  if (c.apiKey) return 'openai'
  if (c.groqApiKey) return 'groq'
  if (c.whisperCpp) return 'whisper-local'
  return undefined
}

export function apply(ctx, config = {}) {
  const tools = ctx.get('tools')
  if (tools === undefined) return
  tools.register({
    name: 'transcribe_audio',
    description:
      'Transcribe an audio file into text through the voicelens ASR bridge. Use whenever a message references an audio recording the current model cannot hear: a local file path or an http(s) URL to a .wav/.mp3/.m4a/.webm/.ogg/.flac file. Returns structured evidence (full text, detected language, provider). Requires a configured voicelens provider; without one it fails with the exact config command to run.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute local file path of the audio file.',
        },
        url: {
          type: 'string',
          description: 'http(s) URL of the audio file.',
        },
        language: {
          type: 'string',
          description: 'Optional ISO-639-1 language hint (e.g. "zh", "en").',
        },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Full transcription.' },
          language: { type: 'string', description: 'Detected or hinted language.' },
          provider: { type: 'string', description: 'ASR provider that ran.' },
        },
        required: ['text', 'provider'],
      },
      render: (_args, value) => [{ type: 'text', text: renderTranscript(value) }],
    },
    timeoutMs: 180_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: 'transcribe_audio',
      kind: 'read',
      rawInput: args,
      ...(typeof args?.path === 'string' ? { locations: [{ path: args.path }] } : {}),
    }),
    async execute(args, exec) {
      const config = { ...(await loadConfig()), ...args }
      const provider = pickProvider(config)
      if (provider === undefined) {
        throw new Error(
          'voicelens: no ASR provider configured. Set one of:\n' +
            '  VOICELENS_OPENAI_API_KEY (OpenAI-compatible whisper endpoint, plus VOICELENS_OPENAI_BASE_URL/MODEL)\n' +
            '  VOICELENS_GROQ_API_KEY (free tier, whisper-large-v3)\n' +
            '  VOICELENS_WHISPER_CPP (path to a whisper.cpp `main` binary)\n' +
            'or write ~/.voicelens/config.json: {"provider":"groq","groqApiKey":"..."}',
        )
      }
      const source = args?.url
        ? await loadUrl(args.url, exec.signal)
        : args?.path
          ? await loadPath(args.path)
          : undefined
      if (source === undefined) {
        throw new Error('transcribe_audio needs a non-empty "path" or "url".')
      }
      const result = await transcribe(provider, source, config, exec.signal)
      return result
    },
  })
}

async function loadUrl(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`voicelens: download failed (HTTP ${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const mime = res.headers.get('content-type')?.split(';')[0].trim() || undefined
  return { bytes, mime, filename: basename(new URL(url).pathname) || 'audio' }
}

async function loadPath(path) {
  const bytes = new Uint8Array(await readFile(path))
  const ext = extnameLower(path)
  return { bytes, mime: MIME_BY_EXT[ext], filename: basename(path) }
}

function extnameLower(p) {
  const dot = p.lastIndexOf('.')
  return dot === -1 ? '' : p.slice(dot).toLowerCase()
}

async function transcribe(provider, source, config, signal) {
  if (provider === 'openai' || provider === 'groq') {
    return transcribeOpenAI(provider, source, config, signal)
  }
  if (provider === 'whisper-local') {
    return transcribeWhisperLocal(source, config, signal)
  }
  throw new Error(`voicelens: unknown provider "${provider}"`)
}

async function transcribeOpenAI(provider, source, config, signal) {
  const c = { ...envConfig(), ...config }
  const baseUrl =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1'
      : (c.baseUrl || 'https://api.openai.com/v1')
  const apiKey = provider === 'groq' ? c.groqApiKey : c.apiKey
  if (!apiKey) {
    throw new Error(
      `voicelens: provider "${provider}" needs an API key (${provider === 'groq' ? 'VOICELENS_GROQ_API_KEY' : 'VOICELENS_OPENAI_API_KEY'})`,
    )
  }
  const model = c.model || (provider === 'groq' ? 'whisper-large-v3' : 'whisper-1')
  const mime = source.mime || 'audio/webm'
  const form = new FormData()
  form.append('file', new Blob([source.bytes], { type: mime }), source.filename || `audio${MEDIA_EXT[mime] || '.webm'}`)
  form.append('model', model)
  if (c.lang || c.language) form.append('language', c.lang || c.language)

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
  const c = { ...envConfig(), ...config }
  const bin = c.whisperCpp
  if (!bin) throw new Error('voicelens: whisper-local needs VOICELENS_WHISPER_CPP (path to whisper.cpp main)')
  const ext = MEDIA_EXT[source.mime] || extnameLower(source.filename) || '.wav'
  const dir = await mkdir(join(tmpdir(), 'voicelens-dsh-'), { recursive: true })
  const file = join(dir, `audio${ext}`)
  await writeFile(file, source.bytes, { mode: 0o600 })
  const args = ['-m', c.whisperModel || 'models/ggml-base.bin', '-f', file, '--output-txt', '--output-file', join(dir, 'out')]
  if (c.lang || c.language) args.push('-l', c.lang || c.language)
  try {
    const { code, stderr } = await run(bin, args, signal)
    if (code !== 0) throw new Error(`whisper.cpp failed (exit ${code}): ${stderr.slice(0, 300)}`)
    const text = await readFile(join(dir, 'out.txt'), 'utf8')
    return { text: text.trim(), language: c.lang || undefined, provider: 'whisper-local' }
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

function renderTranscript(value) {
  const lines = [value.text?.trim() || '(empty transcript)']
  if (value.language) lines.push('', `Language: ${value.language}`)
  lines.push('', `Provider: ${value.provider}`)
  return lines.join('\n')
}
