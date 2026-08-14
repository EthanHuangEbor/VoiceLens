# voicelens

**语音输入与音频转写引擎** —— 一个引擎，多端复用，给文本模型配上"耳朵"。

- 🎙️ **DSH 麦克风按钮**：composer 工具行点一下说话，语音即时转文字写入输入框（浏览器原生 `SpeechRecognition`，Chrome/Edge 零配置）。
- 📝 **`transcribe_audio` 工具**（DSH）：模型可显式调用，转写音频文件/URL 为结构化文本证据。
- 🖥️ **`voicelens` CLI**（任意宿主）：`voicelens transcribe <file|url>` → `{text, language, provider}`，任何读技能的 agent 都能用。
- 🔌 **可配置 ASR 引擎**：`groq`（免费）、`openai`（任意 OpenAI 兼容 `/audio/transcriptions`）、`whisper-local`（whisper.cpp，零 key）。分层配置 `VOICELENS_*` > `~/.voicelens/config.json`。

## 架构（镜像 modlens 的三层分离）

| 层 | modlens（视觉） | voicelens（语音） |
| --- | --- | --- |
| 核心引擎 | `modlens` CLI + 5 vision providers | `voicelens` CLI + 3 ASR providers |
| 通用技能 | `skills/modlens/SKILL.md` | `skills/voicelens/SKILL.md`（harness 无关） |
| 平台原生 | DSH 插件（read_image + vision adapter） | DSH 插件（transcribe_audio 工具 + 麦克风按钮） |
| 安装文档 | INSTALL.md 每平台 | INSTALL.md 每平台 |

```
voicelens/
├── src/                     # 核心引擎（harness 无关，纯 ESM 无 build）
│   ├── main.js              #   CLI: transcribe / doctor
│   ├── providers.js         #   ASR 接口 + openai/groq/whisper-local
│   ├── config.js            #   分层配置
│   ├── doctor.js            #   诊断
│   └── schema.js            #   输出契约
├── bin/voicelens.js         # CLI 入口
├── dsh/index.js             # DSH 插件（薄）：transcribe_audio 工具
├── client/index.js          # DSH 麦克风按钮
├── skills/voicelens/        # 通用技能
├── installers/              # 每平台一键安装
└── INSTALL.md               # 每平台安装说明
```

关键区别（vs modlens）：DSH 的 `attachments` 服务是纯图片的、内容块只有 Text/Image、`ModelModality` 仅 text|image，因此没有"音频准入门"可解锁 —— 语音必须自造摄入端（DSH 客户端麦克风按钮）。模型侧文件转写（`transcribe_audio` / CLI）则天然多平台。

## 安装

见 [INSTALL.md](INSTALL.md)。快速版：

```bash
# CLI（任意宿主）
npm install -g voicelens

# DSH 原生插件
dsh plugin --profile web add voicelens

# 通用技能（Claude Code / Codex / Pi / OpenClaw …）
cp -R skills/voicelens ~/.claude/skills/voicelens   # 或其他宿主目录
```

## 配置 ASR

```bash
export VOICELENS_PROVIDER=groq
export VOICELENS_GROQ_API_KEY=gsk_...   # 免费额度
# 或写入 ~/.voicelens/config.json: {"provider":"groq","groqApiKey":"..."}
```

DSH 麦克风按钮无需 provider（浏览器语音）；只有模型侧文件转写需要。

## 开发验证

```bash
node scripts/smoke-host.mjs       # Host 引擎 + 工具注册
node scripts/smoke-client.mjs     # 客户端 bundle 执行 + 插槽注册
node src/main.js doctor           # CLI 诊断（无 provider 也安全）
```

## License

MIT
