# Installing voicelens

voicelens is one engine, many harnesses: a **harness-agnostic CLI** (`voicelens`)
plus a **universal skill**, with a **DSH-native plugin** (mic button + tool) on top.
Pick the row for each harness you use; they can all share one
`~/.voicelens/config.json`.

## 0. Install the CLI (needed for every harness except DSH tool-only use)

```bash
npm install -g voicelens        # published
# or, from a local checkout:
npm install -g .
```

Verify: `voicelens doctor`.

## 1. DeepSeek Harness (dsh) — native

```bash
dsh plugin --profile web add voicelens
```

- Composer gets a 🎤 mic button (browser speech, Chrome/Edge, zero config).
- The model gets the `transcribe_audio` tool (needs a configured ASR provider).
- Copy the skill too, so the model gets the trigger guidance:
  `skills/voicelens` → `~/.dsh/skills/voicelens` (or `$DSH_HOME/skills/voicelens`).

## 2. Claude Code — skill + CLI

```bash
mkdir -p ~/.claude/skills
cp -R skills/voicelens ~/.claude/skills/voicelens
```

The skill triggers on audio; the agent runs `voicelens transcribe <file>`.

## 3. Codex — skill + CLI

```bash
mkdir -p ~/.codex/skills
cp -R skills/voicelens ~/.codex/skills/voicelens
```

## 4. Pi / OpenCode — skill + CLI

```bash
mkdir -p ~/.agents/skills
cp -R skills/voicelens ~/.agents/skills/voicelens
```

## 5. OpenClaw / Hermes — skill + CLI

```bash
mkdir -p ~/.openclaw/workspace/skills   # adjust per your install
cp -R skills/voicelens ~/.openclaw/workspace/skills/voicelens
```

## 6. Project-local install (any harness)

```bash
mkdir -p .agents/skills         # or .dsh/skills / .claude/skills
cp -R <checkout>/skills/voicelens .agents/skills/voicelens
```

## One-shot installer

```bash
bash installers/install.sh      # macOS / Linux
powershell -File installers/install.ps1   # Windows
```

copies the skill into every detected harness skill dir and links the CLI.

## Configure ASR (for `transcribe_audio` / `voicelens transcribe`)

```bash
# Groq free tier (recommended)
export VOICELENS_PROVIDER=groq
export VOICELENS_GROQ_API_KEY=gsk_...

# or OpenAI-compatible endpoint
export VOICELENS_PROVIDER=openai
export VOICELENS_OPENAI_API_KEY=sk-...
export VOICELENS_OPENAI_BASE_URL=https://api.openai.com/v1
export VOICELENS_OPENAI_MODEL=whisper-1

# or write ~/.voicelens/config.json: {"provider":"groq","groqApiKey":"..."}
```

The DSH mic button works with no provider (browser speech); only the
model-side file transcription needs one.
