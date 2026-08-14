// voicelens core engine — layered config (harness-agnostic).
// Precedence: process env VOICELENS_*  >  ~/.voicelens/config.json  >  defaults.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const CONFIG_PATH = join(homedir(), '.voicelens', 'config.json')

/** Environment bindings (higher precedence than the config file). */
export function envConfig() {
  return {
    provider: process.env.VOICELENS_PROVIDER,
    lang: process.env.VOICELENS_LANG,
    baseUrl: process.env.VOICELENS_OPENAI_BASE_URL,
    apiKey: process.env.VOICELENS_OPENAI_API_KEY,
    model: process.env.VOICELENS_OPENAI_MODEL,
    groqApiKey: process.env.VOICELENS_GROQ_API_KEY,
    whisperCpp: process.env.VOICELENS_WHISPER_CPP,
    whisperModel: process.env.VOICELENS_WHISPER_MODEL,
  }
}

/** Read the config file; absent or malformed → {}. */
export async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

/** Right-to-left override merge, dropping undefined values. */
export function mergeConfig(...layers) {
  const out = {}
  for (const layer of layers) {
    if (layer === null || typeof layer !== 'object') continue
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) out[key] = value
    }
  }
  return out
}

/** Pick the ASR provider from merged config: explicit > first credential found. */
export function pickProvider(config) {
  if (config.provider) return config.provider
  if (config.apiKey) return 'openai'
  if (config.groqApiKey) return 'groq'
  if (config.whisperCpp) return 'whisper-local'
  return undefined
}

/** Human guidance rendered when no provider is configured. */
export const CONFIG_GUIDANCE = [
  'voicelens: no ASR provider configured. Set one of:',
  '  VOICELENS_OPENAI_API_KEY (OpenAI-compatible whisper endpoint, plus VOICELENS_OPENAI_BASE_URL/MODEL)',
  '  VOICELENS_GROQ_API_KEY (free tier, whisper-large-v3)',
  '  VOICELENS_WHISPER_CPP (path to a whisper.cpp `main` binary)',
  'or write ~/.voicelens/config.json: {"provider":"groq","groqApiKey":"..."}',
].join('\n')
