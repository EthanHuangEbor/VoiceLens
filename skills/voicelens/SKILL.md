---
name: voicelens
description: "Audio transcription for skill-reading agents. Use when the user wants to transcribe an audio file (local path or http(s) URL) into text, or to configure voicelens ASR providers. Detect the host and run the matching entry: DeepSeek Harness → transcribe_audio tool; other hosts (Claude Code, Codex, Pi, OpenClaw, …) → `voicelens transcribe` CLI."
---

# voicelens 音频转写 / 语音输入

## 触发条件

- 用户给了一个音频文件路径或 URL，要求"转写 / 听写 / 语音转文字 / 提取音频内容"。
- 用户询问如何配置 voicelens 的 ASR 引擎（OpenAI 兼容端点 / Groq / whisper.cpp）。
- （仅 DSH）用户在输入框点麦克风按钮说话 —— 这条路径由客户端插件自动完成，**不需要**本技能介入。

## 核心规则

音频出现但当前模型"听不到"时，**不要**自己写 ffmpeg / OCR / 转写脚本，先转写并引用返回的 `text` 作为证据。

## 执行（按宿主检测）

1. **DeepSeek Harness**（有 `transcribe_audio` 工具）→ 直接调用该工具，传 `path` 或 `url`。
2. **其他宿主**（Claude Code / Codex / Pi / OpenClaw / OpenCode …）→ 运行 CLI：
   ```bash
   voicelens transcribe <file-or-url> [--lang zh] [--provider groq]
   ```
   输出 JSON：`{ "text", "language", "provider" }`，引用 `text` 作为证据。
3. 诊断（任何宿主）：
   ```bash
   voicelens doctor
   ```

## 配置（供 agent 替用户执行）

配置分层：环境变量 `VOICELENS_*` > `~/.voicelens/config.json` > 内置默认。

### 方案 A：Groq（免费额度，推荐）

```
VOICELENS_PROVIDER=groq
VOICELENS_GROQ_API_KEY=<gsk_...>
```

### 方案 B：OpenAI 兼容端点（任意 whisper 网关）

```
VOICELENS_PROVIDER=openai
VOICELENS_OPENAI_API_KEY=<key>
VOICELENS_OPENAI_BASE_URL=https://api.openai.com/v1
VOICELENS_OPENAI_MODEL=whisper-1
```

### 方案 C：本地 whisper.cpp（零 key）

```
VOICELENS_PROVIDER=whisper-local
VOICELENS_WHISPER_CPP=/path/to/whisper.cpp/build/bin/main
VOICELENS_WHISPER_MODEL=/path/to/ggml-base.bin
```

或写入 `~/.voicelens/config.json`：

```json
{ "provider": "groq", "groqApiKey": "gsk_..." }
```

## 输出契约

`{ text, language?, provider }` —— 模型侧转写统一走这个形状（工具与 CLI 一致）。

## 已知边界

- DSH 当前没有音频消息管线（`attachments` 仅图片、`ModelModality` 仅 text|image），所以语音摄入端在 DSH 客户端麦克风按钮；模型侧文件转写走本技能/工具。
- DSH 麦克风按钮依赖 Chrome/Edge 的 `SpeechRecognition`（零配置）；其余浏览器提示切换。
