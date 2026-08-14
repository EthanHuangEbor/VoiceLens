// voicelens — dsh client bundle (loaded via window.__ModuleLoader__).
//
// Adds a mic button to the composer tool row (`conversation.input.left`). One
// click starts browser-native speech recognition (Chrome/Edge: SpeechRecognition,
// zero config, zero key) and streams the final transcript into the input draft
// through the framework-provided `inputActions.setDraft`. dsh has no audio
// message pipeline, so the browser is the voice intake; the host half covers
// model-driven transcription of audio files through `transcribe_audio`.
window.__ModuleLoader__.load({
  id: 'voicelens',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var react = require('react')

    var CSS = [
      '.vl-mic{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8f98);cursor:pointer;border-radius:6px;padding:0;flex:none}',
      '.vl-mic:hover{background:var(--dsw-alias-bg-fill-neutral,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#1f2329)}',
      '.vl-mic[data-rec="true"]{color:#e5484d}',
      '.vl-mic .vl-pulse{width:9px;height:9px;border-radius:50%;background:#e5484d;animation:vl-pulse 1.1s ease-in-out infinite}',
      '@keyframes vl-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.72)}}',
      '.vl-wrap{position:relative;display:inline-flex;align-items:center}',
      '.vl-interim{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;background:var(--dsw-alias-bg-elevated,#fff);border:1px solid var(--dsw-alias-line-normal,rgba(0,0,0,.1));border-radius:8px;padding:3px 8px;font-size:12px;color:var(--dsw-alias-label-secondary,#444);box-shadow:0 2px 10px rgba(0,0,0,.12);z-index:30}',
    ].join('\n')

    function MicButton(props) {
      var recState = react.useState(false)
      var rec = recState[0]
      var setRec = recState[1]
      var interimState = react.useState('')
      var interim = interimState[0]
      var setInterim = interimState[1]
      var errState = react.useState('')
      var err = errState[0]
      var setErr = errState[1]
      var recogRef = react.useRef(null)
      var baseRef = react.useRef('')
      var committedRef = react.useRef('')
      var manualRef = react.useRef(false)
      var lastBootRef = react.useRef(0)
      var mediaRecRef = react.useRef(null)

      react.useEffect(
        function () {
          return function () {
            manualRef.current = true
            try {
              if (recogRef.current) recogRef.current.abort()
            } catch (e) {}
            if (mediaRecRef.current) {
              try {
                if (mediaRecRef.current.state === 'recording') mediaRecRef.current.stop()
              } catch (e) {}
            }
          }
        },
        [],
      )

      function commitSegment(text) {
        var t = String(text || '').replace(/\s+/g, ' ').trim()
        if (!t) return
        committedRef.current = committedRef.current ? committedRef.current + ' ' + t : t
        var base = baseRef.current
        var next = base ? base + '\n' + committedRef.current : committedRef.current
        if (props.inputActions && typeof props.inputActions.setDraft === 'function') {
          props.inputActions.setDraft(next)
        }
      }

      function start() {
        setErr('')
        manualRef.current = false
        baseRef.current = props.draft && typeof props.draft === 'string' ? props.draft : ''
        committedRef.current = ''
        var SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition
        if (SR) {
          lastBootRef.current = 0
          boot(SR)
          setRec(true)
          return
        }
        startHostRecording()
      }

      function startHostRecording() {
        var nav = globalThis.navigator
        if (!nav || !nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== 'function') {
          setErr('此浏览器不支持语音输入（请用 Chrome/Edge/Firefox/Safari）')
          return
        }
        var MR = globalThis.MediaRecorder
        if (typeof MR !== 'function') {
          setErr('此浏览器不支持录音（MediaRecorder 缺失）')
          return
        }
        nav.mediaDevices.getUserMedia({ audio: true }).then(
          function (stream) {
            var mime = 'audio/webm'
            try {
              if (MR.isTypeSupported && MR.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus'
            } catch (e) {}
            var rec
            try {
              rec = new MR(stream, mime ? { mimeType: mime } : undefined)
            } catch (e) {
              rec = new MR(stream)
            }
            var chunks = []
            rec.ondataavailable = function (e) {
              if (e.data && e.data.size) chunks.push(e.data)
            }
            rec.onstop = function () {
              stream.getTracks().forEach(function (t) { try { t.stop() } catch (e) {} })
              var blobType = (rec.mimeType || mime || 'audio/webm').split(';')[0]
              var blob = new Blob(chunks, { type: blobType })
              transcribeOnHost(blob, blobType)
            }
            rec.onerror = function () {
              setErr('录音失败')
              setRec(false)
            }
            mediaRecRef.current = rec
            rec.start()
            setRec(true)
          },
          function (e) {
            var code = e && e.name ? e.name : 'error'
            setErr(code === 'NotAllowedError' || code === 'SecurityError' ? '麦克风权限被拒绝' : '无法获取麦克风: ' + String(e && e.message || e))
            setRec(false)
          },
        )
      }

      function transcribeOnHost(blob, mime) {
        setRec(false)
        setInterim('转写中…')
        var opts = { method: 'POST', body: blob, headers: { 'Content-Type': mime || 'audio/webm' } }
        globalThis.fetch('/voicelens/transcribe', opts)
          .then(function (r) {
            return r.json().then(function (j) {
              if (!r.ok) throw new Error(j && j.error ? j.error : 'HTTP ' + r.status)
              return j
            })
          })
          .then(function (res) {
            setInterim('')
            if (res && res.text) commitSegment(res.text)
            else setErr('转写结果为空')
          })
          .catch(function (e) {
            setInterim('')
            setErr('转写失败: ' + String(e && e.message || e))
          })
      }

      function boot(SR) {
        var now = Date.now()
        if (now - lastBootRef.current < 300) return
        lastBootRef.current = now
        var r = new SR()
        r.lang = 'zh-CN'
        r.continuous = true
        r.interimResults = true
        r.onresult = function (e) {
          var interimText = ''
          for (var i = e.resultIndex; i < e.results.length; i++) {
            var res = e.results[i]
            if (res.isFinal) commitSegment(res[0].transcript)
            else interimText += res[0].transcript
          }
          setInterim(interimText)
        }
        r.onerror = function (e) {
          var code = e && e.error ? e.error : 'unknown'
          if (code === 'aborted') return
          if (manualRef.current) {
            setRec(false)
            setInterim('')
            return
          }
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            setErr('麦克风权限被拒绝')
            setRec(false)
            setInterim('')
            return
          }
          try {
            boot(SR)
          } catch (err) {
            setRec(false)
          }
        }
        r.onend = function () {
          if (manualRef.current) {
            setRec(false)
            setInterim('')
            return
          }
          try {
            boot(SR)
          } catch (err) {
            setRec(false)
          }
        }
        recogRef.current = r
        try {
          r.start()
        } catch (e) {
          setErr('无法启动麦克风: ' + String((e && e.message) || e))
          setRec(false)
        }
      }

      function stop() {
        manualRef.current = true
        if (recogRef.current) {
          try {
            recogRef.current.stop()
          } catch (e) {}
        }
        if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
          try {
            mediaRecRef.current.stop()
          } catch (e) {}
        }
      }

      function onClick() {
        if (rec) {
          stop()
          return
        }
        start()
      }

      var btn = react.createElement(
        'button',
        {
          type: 'button',
          className: 'vl-mic',
          title: rec ? '点击停止录音' : '语音输入（点一下说话）',
          'data-rec': rec ? 'true' : 'false',
          onClick: onClick,
        },
        rec
          ? react.createElement('span', { className: 'vl-pulse' })
          : react.createElement(
              'svg',
              { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor', 'aria-hidden': true },
              react.createElement('path', { d: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z' }),
              react.createElement('path', {
                d: 'M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.08A7 7 0 0 0 19 11z',
              }),
            ),
      )
      var tip = err
        ? react.createElement('span', { className: 'vl-interim' }, err)
        : interim
          ? react.createElement('span', { className: 'vl-interim' }, interim)
          : null
      return react.createElement('span', { className: 'vl-wrap' }, btn, tip)
    }

    function apply(ctx) {
      var style = document.createElement('style')
      style.dataset.plugin = 'voicelens'
      style.textContent = CSS
      document.head.appendChild(style)
      ctx.effect(function () {
        return function () {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'voicelens: styles')

      ctx.slots.inject('conversation.input.left', function () {
        return ctx.slots.register(
          { name: 'conversation.input.left', id: 'voicelens.mic', order: 500, label: '语音输入' },
          function (props) {
            return react.createElement(MicButton, {
              draft: props.input && props.input.draft,
              inputActions: props.inputActions,
            })
          },
        )
      })
    }

    exports.name = 'voicelens'
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
