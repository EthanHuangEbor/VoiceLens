// voicelens — DeepSeek Harness (dsh) host plugin.
//
// Faithful port of the @liustack/modlens integration shape, applied to speech:
// a model-callable `transcribe_audio` tool backed by the harness-agnostic core
// engine in src/ (same providers + config shared by the CLI and every harness).
//
// Two model/UI-facing surfaces:
//   1. `transcribe_audio` tool — the MODEL transcribes an audio file/URL.
//   2. `/voicelens/transcribe` HTTP route — the CLIENT mic button uploads live
//      recorded audio bytes when the browser has no SpeechRecognition
//      (Firefox / Safari), so every browser gets a voice path.

import { envConfig, loadConfig, mergeConfig, pickProvider, CONFIG_GUIDANCE } from '../src/config.js'
import { transcribe, loadUrl, loadPath, renderTranscript } from '../src/providers.js'
import { OUTPUT_SCHEMA } from '../src/schema.js'

export const name = 'voicelens'
export const inject = ['tools']

export function apply(ctx, config = {}) {
  const tools = ctx.get('tools')
  if (tools !== undefined) {
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
        schema: OUTPUT_SCHEMA,
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
        const cfg = mergeConfig(envConfig(), await loadConfig(), args, config)
        const provider = pickProvider(cfg)
        if (provider === undefined) {
          throw new Error(CONFIG_GUIDANCE)
        }
        const source = args?.url
          ? await loadUrl(args.url, exec.signal)
          : args?.path
            ? await loadPath(args.path)
            : undefined
        if (source === undefined) {
          throw new Error('transcribe_audio needs a non-empty "path" or "url".')
        }
        return transcribe(provider, source, cfg, exec.signal)
      },
    })
  }

  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    registerTranscribeRoute(webServer)
  }
}

/** Client mic-button fallback: POST live audio bytes → transcribe → JSON. */
function registerTranscribeRoute(webServer) {
  webServer.register({
    kind: 'prefix',
    path: '/voicelens/transcribe',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'method not allowed' }))
        return
      }
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const bytes = Buffer.concat(chunks)
        if (bytes.length === 0) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: 'empty audio body' }))
          return
        }
        const mime = String(req.headers['content-type'] || 'audio/webm').split(';')[0].trim()
        const lang = String(req.headers['x-voicelens-lang'] || '')
        const cfg = mergeConfig(envConfig(), await loadConfig(), lang ? { lang } : {})
        const provider = pickProvider(cfg)
        if (provider === undefined) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: CONFIG_GUIDANCE }))
          return
        }
        const result = await transcribe(provider, { bytes, mime }, cfg)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: String(error && error.message ? error.message : error) }))
      }
    },
  })
}
