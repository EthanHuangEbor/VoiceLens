# voicelens 设计文档

## 目标

给 DeepSeek Harness（dsh）增加语音输入能力：对话框语音发送 + 语音自动转文字。

## 背景：modlens 的接入机制（深度解析结论）

modlens（视觉桥）通过三层 Host 钩子接入 dsh：

1. **工具层**：`ctx.tools.register('read_image')` —— 模型显式调用，spawn 锁版本 CLI 引擎，返回结构化 JSON。
2. **pre-step 重写**：监听 `agent/pre-step` waterfall，把 `image` 内容块重写为文本证据块。
3. **LLM adapter 模态包装（核心）**：`ctx.llm.registerAdapter` 注册新 provider，声明 `inputModalities:['text','image']` 解锁图片粘贴准入门，`stream()` 里先把图片转证据再委托回上游。

modlens 能"零客户端代码"，是因为 dsh **已自带图片摄入管线**（粘贴 → image attachment → image 块）。

## 语音的现实约束（查证结论）

dsh 当前**没有音频**：

- `attachments` 服务仅 `validateImage/saveImage/readImage`（无音频接口）。
- `dsh-llm` 的 `ModelModality = 'text' | 'image'`，内容块仅 `TextBlock`/`ImageBlock`。
- 因此无"音频消息块"可重写、无"音频准入门"可解锁。

## 架构

| 层 | 实现 |
| --- | --- |
| 模型工具 | `transcribe_audio`（Host，1:1 移植 read_image） |
| ASR 引擎 | `openai` / `groq` / `whisper-local` 三 provider + 分层配置 + failover |
| 摄入端 | **新增**客户端麦克风按钮（`conversation.input.left`），浏览器 `SpeechRecognition` 零配置，`inputActions.setDraft` 写入草稿 |
| pre-step / adapter | 结构预留，待 dsh 出现音频模态后启用（空实现，含注释） |

## 关键 API（已确认）

- 插槽 `conversation.input.left`（list, session, additive, replaceRisk:none），registration `{id,order,label}`。
- standard props：`inputActions.setDraft(text)`、`useInput`；owner props：`InputZone { session, input }`。
- 客户端 bundle：`window.__ModuleLoader__.load({id,factory(require){...}})`, `exports.{name,inject,apply}`，经 `dsh.client` + `exports["./client"]` 由 `dsh-client-modules` 注入 `window.__DSH_BOOT__`。
- Host 插件：ESM `export { name, inject, apply }`，经 `cordis.patch.yml` 的 `insert` 行挂载。

## 状态

- v0.1.0：麦克风按钮（浏览器语音）+ `transcribe_audio` 工具 + 三 provider ASR 引擎。
- 后续：MediaRecorder → Host 转写（覆盖无 Web Speech 的浏览器）；dsh 出现音频模态后启用 pre-step/adapter 层。
