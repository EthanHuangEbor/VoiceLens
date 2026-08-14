---
name: voicelens
description: "Voice input and audio transcription for DeepSeek Harness. Use when the user wants to transcribe an audio file (path or URL) into text, or to configure the voicelens ASR providers. The in-composer mic button (browser speech) needs no skill action."
---

# voicelens 语音输入 / 音频转写

## 什么时候用

- 用户给了一个音频文件路径或 URL，要求"转写 / 听写 / 语音转文字 / 提取音频内容"时，调用 `transcribe_audio` 工具。
- 用户询问如何配置 voicelens 的 ASR 引擎（OpenAI 兼容端点 / Groq / whisper.cpp）时。
- 用户在输入框里点麦克风按钮说话 —— 这条路径由客户端插件自动完成，**不需要**本技能介入。

## 核心规则

音频出现但当前模型"听不到"时，**不要**自己写 OCR / ffmpeg 转写脚本，先调用 `transcribe_audio` 工具，并引用返回的 `text` 作为证据。

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
VOICELENS_OPENAI_BASE_URL=https://api.openai.com/v1   # 或你的网关
VOICELENS_OPENAI_MODEL=whisper-1                        # 或 whisper-large-v3
```

### 方案 C：本地 whisper.cpp（零 key）

```
VOICELENS_PROVIDER=whisper-local
VOICELENS_WHISPER_CPP=/path/to/whisper.cpp/build/bin/main
VOICELENS_WHISPER_MODEL=/path/to/ggml-base.bin
```

或写入 `~/.voicelens/config.json`（0600 权限，掩码显示）：

```json
{ "provider": "groq", "groqApiKey": "gsk_..." }
```

## 输出契约

`transcribe_audio` 返回结构化 JSON：`{ text, language?, provider }`，渲染为 `全文 + Language + Provider`。

## 已知边界

- dsh 当前没有音频消息管线（`attachments` 仅图片、`ModelModality` 仅 text|image），所以没有"音频准入门"可解锁；语音摄入端在客户端麦克风按钮，模型侧的文件转写走本工具。
- 浏览器麦克风按钮依赖 Chrome/Edge 的 `SpeechRecognition`（零配置）；其余浏览器提示切换。
