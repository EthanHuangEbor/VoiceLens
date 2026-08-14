// voicelens core engine — offline diagnostics (mirrors `modlens doctor`).
import { CONFIG_PATH, pickProvider } from './config.js'

/** Report provider readiness + selected provider without spending quota. */
export async function doctor(config) {
  const providers = {
    openai: config.apiKey ? 'ok' : 'missing: apiKey',
    groq: config.groqApiKey ? 'ok' : 'missing: apiKey',
    'whisper-local': config.whisperCpp ? 'ok' : 'missing: whisperCpp',
  }
  const provider = pickProvider(config)
  return {
    configPath: CONFIG_PATH,
    providers,
    selectedProvider: provider ?? '(none)',
    lang: config.lang ?? '(auto)',
  }
}

export function renderDoctor(report) {
  const lines = ['voicelens doctor (offline: no network, no quota)', '']
  lines.push('Providers')
  for (const [name, state] of Object.entries(report.providers)) {
    lines.push(`  [${state === 'ok' ? 'ok' : '!!'}] ${name}: ${state}`)
  }
  lines.push('', `Selected provider: ${report.selectedProvider}`, `Language: ${report.lang}`, `Config file: ${report.configPath}`)
  return lines.join('\n')
}
