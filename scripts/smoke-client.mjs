// Smoke test for the voicelens client bundle (executes the hand-written
// window.__ModuleLoader__ bundle against mock require/react/document/ctx).
import { readFileSync } from 'node:fs'

const code = readFileSync(new URL('../client/index.js', import.meta.url), 'utf8')

let moduleDef = null
globalThis.window = {
  __ModuleLoader__: { load: (def) => (moduleDef = def) },
}
globalThis.document = {
  createElement: () => ({ dataset: {}, textContent: '' }),
  head: { appendChild: () => {} },
}

// Run the bundle script (indirect eval → global scope, `window` resolves).
;(0, eval)(code)
if (!moduleDef) throw new Error('bundle did not register via __ModuleLoader__')
console.log('✓ module id:', moduleDef.id)

const react = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (init) => [init, () => {}],
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
}

const registrations = []
const ctx = {
  effect: () => () => {},
  slots: {
    inject: (_slot, cb) => {
      cb()
      return () => {}
    },
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

const exportsObj = moduleDef.factory((spec) => {
  if (spec === 'react') return react
  throw new Error('unexpected require: ' + spec)
})

console.log('✓ exports.name:', exportsObj.name)
console.log('✓ exports.inject:', JSON.stringify(exportsObj.inject))

exportsObj.apply(ctx)

if (registrations.length !== 1) throw new Error('expected 1 slot registration, got ' + registrations.length)
const reg = registrations[0]
console.log('✓ slot registration options:', JSON.stringify(reg.options))

// Render the component once with fake props to exercise the render path.
const component = reg.component
const el = component({ draft: 'hello', inputActions: { setDraft: () => {} } })
console.log('✓ rendered element type:', el.type)
console.log('✓ render produced a <span class=vl-wrap>:', el.props.className === 'vl-wrap')

console.log('\nALL CLIENT SMOKE TESTS PASSED')
