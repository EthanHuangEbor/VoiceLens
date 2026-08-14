// voicelens CLI — the harness-agnostic engine entry (like `modlens`).
//   voicelens transcribe <file|url> [--lang zh] [--provider x]   → JSON to stdout
//   voicelens doctor                                              → human diagnostics
import { envConfig, loadConfig, mergeConfig, pickProvider, CONFIG_GUIDANCE } from './config.js'
import { transcribe, loadUrl, loadPath } from './providers.js'
import { doctor, renderDoctor } from './doctor.js'

function parseArgs(argv) {
  const out = { lang: undefined, provider: undefined, target: undefined, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lang' || a === '-l') out.lang = argv[++i]
    else if (a === '--provider' || a === '-p') out.provider = argv[++i]
    else if (a === '--json') out.json = true
    else if (!a.startsWith('-') && out.target === undefined) out.target = a
  }
  return out
}

async function runTranscribe(argv) {
  const args = parseArgs(argv)
  if (!args.target) {
    console.error('usage: voicelens transcribe <file|url> [--lang zh] [--provider x]')
    process.exit(2)
  }
  const config = mergeConfig(envConfig(), await loadConfig(), { lang: args.lang, provider: args.provider })
  const provider = pickProvider(config)
  if (!provider) {
    console.error(CONFIG_GUIDANCE)
    process.exit(3)
  }
  const source = /^https?:\/\//i.test(args.target) ? await loadUrl(args.target) : await loadPath(args.target)
  const result = await transcribe(provider, source, config)
  console.log(JSON.stringify(result, null, 2))
}

async function runDoctor() {
  const config = mergeConfig(envConfig(), await loadConfig())
  console.log(renderDoctor(await doctor(config)))
}

const cmd = process.argv[2]
if (cmd === 'doctor') {
  await runDoctor()
} else if (cmd === 'transcribe') {
  await runTranscribe(process.argv.slice(3))
} else {
  // bare `voicelens` with a target behaves like `transcribe` for convenience
  await runTranscribe(process.argv.slice(2))
}
