# voicelens

**DeepSeek Harness (dsh) 的语音输入与音频转写插件** —— 给文本模型配上"耳朵"。

- 🎙️ **composer 麦克风按钮**：在输入框工具行点一下麦克风说话，语音即时转文字写入输入框（浏览器原生 `SpeechRecognition`，Chrome/Edge 零配置零 key）。
- 📝 **`transcribe_audio` 工具**：模型可显式调用，把任意音频文件（本地路径或 http(s) URL）转写成结构化文本证据，返回 `{ text, language, provider }`。
- 🔌 **可配置 ASR 引擎**：`groq`（免费额度）、`openai`（任意 OpenAI 兼容 `/audio/transcriptions` 端点）、`whisper-local`（whisper.cpp，零 key）。分层配置：环境变量 `VOICELENS_*` > `~/.voicelens/config.json` > 默认。

## 设计（镜像 modlens）

voicelens 是 [modlens](https://github.com/liustack/modlens) 视觉桥方案在语音上的同构移植：

| 层 | modlens（视觉） | voicelens（语音） |
| --- | --- | --- |
| 模型工具 | `read_image` | `transcribe_audio` |
| 引擎 | 5 个 vision provider + `~/.modlens/config.json` + `doctor` | 3 个 ASR provider + `~/.voicelens/config.json` |
| 摄入端 | 复用 dsh 已有图片粘贴管线 | **新增**客户端麦克风按钮（dsh 无音频管线） |
| 模态包装 | `ctx.llm.registerAdapter` 声明 `inputModalities:['text','image']` | 暂缺 —— dsh 的 `ModelModality` 仅 text|image，等音频模态出现后一行启用 |

关键区别：dsh 的 `attachments` 服务是纯图片的、内容块只有 `TextBlock`/`ImageBlock`，因此没有"音频准入门"可解锁 —— 语音必须自造摄入端（客户端麦克风）。

## 安装

```bash
# 全局（所有项目）
dsh plugin --profile web add <本包>        # npm 名或本地路径

# 本地开发
dsh plugin --profile web add D:\path\to\voicelens
```

安装后重启/刷新 web 会话，composer 工具行即出现麦克风按钮。

## 配置 ASR（可选，用于 transcribe_audio 工具）

```bash
# Groq 免费额度
set VOICELENS_PROVIDER=groq
set VOICELENS_GROQ_API_KEY=gsk_...

# 或 OpenAI 兼容端点
set VOICELENS_PROVIDER=openai
set VOICELENS_OPENAI_API_KEY=sk-...
set VOICELENS_OPENAI_BASE_URL=https://api.openai.com/v1
set VOICELENS_OPENAI_MODEL=whisper-1
```

未配置时，麦克风按钮仍可用（浏览器原生识别），`transcribe_audio` 工具会返回精确的配置指引。

## 目录结构

```
voicelens/
├── dsh/index.js        # Host：transcribe_audio 工具 + ASR 引擎
├── client/index.js     # Client：composer 麦克风按钮
├── cordis.patch.yml    # bundle 挂载补丁
├── skills/voicelens/   # 伴随技能
└── package.json        # dsh.bundle + dsh.client 清单
```

## License

MIT
