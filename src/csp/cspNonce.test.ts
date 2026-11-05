// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { getCspNonce, mountHtml, mountSvg, setCspNonce, withCspNonce } from './cspNonce.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

function meta(nonce: string) {
  const el = document.createElement('meta')
  el.setAttribute('property', 'csp-nonce')
  el.setAttribute('nonce', nonce)
  document.head.appendChild(el)
  return el
}

afterEach(() => {
  setCspNonce(undefined)
  document.head.querySelectorAll('meta[property="csp-nonce"]').forEach((m) => m.remove())
})

describe('getCspNonce', () => {
  it('is undefined without a policy', () => {
    expect(getCspNonce()).toBeUndefined()
  })

  it("reads the page's csp-nonce meta tag (Vite's html.cspNonce)", () => {
    meta('from-meta')
    expect(getCspNonce()).toBe('from-meta')
  })

  it('prefers the nonce the app sets, until cleared', () => {
    meta('from-meta')
    setCspNonce('from-app')
    expect(getCspNonce()).toBe('from-app')
    setCspNonce(undefined)
    expect(getCspNonce()).toBe('from-meta')
  })
})

describe('withCspNonce', () => {
  it('gives the nonce to HTML and SVG style elements made while the work runs, then restores the document', async () => {
    setCspNonce('n1')
    const create = document.createElement
    const createNS = document.createElementNS
    const made = await withCspNonce(async () => [
      document.createElement('style'),
      document.createElementNS(SVG_NS, 'style'),
      document.createElement('div'),
      document.createElementNS(SVG_NS, 'g'),
    ])
    expect(made[0].getAttribute('nonce')).toBe('n1')
    expect(made[1].getAttribute('nonce')).toBe('n1')
    expect(made[2].hasAttribute('nonce')).toBe(false)
    expect(made[3].hasAttribute('nonce')).toBe(false)
    expect(document.createElement).toBe(create)
    expect(document.createElementNS).toBe(createNS)
    expect(document.createElement('style').hasAttribute('nonce')).toBe(false)
  })

  it('applies style attributes set by script through CSSOM while the work runs', async () => {
    setCspNonce('n4')
    const setAttribute = Element.prototype.setAttribute
    const el = document.createElement('div')
    const g = document.createElementNS(SVG_NS, 'g')
    await withCspNonce(async () => {
      el.setAttribute('style', 'width: 12px')
      g.setAttribute('style', 'opacity: 0.25')
      el.setAttribute('title', 'kept')
    })
    expect(el.style.width).toBe('12px')
    expect((g as SVGGElement).style.opacity).toBe('0.25')
    expect(el.getAttribute('title')).toBe('kept')
    expect(Element.prototype.setAttribute).toBe(setAttribute)
  })

  it('restores the document once overlapping calls have all ended, even when one throws', async () => {
    setCspNonce('n2')
    const create = document.createElement
    const setAttribute = Element.prototype.setAttribute
    let release!: () => void
    const slow = withCspNonce(() => new Promise<void>((r) => (release = r)))
    await expect(withCspNonce(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(document.createElement('style').getAttribute('nonce')).toBe('n2')
    release()
    await slow
    expect(document.createElement).toBe(create)
    expect(Element.prototype.setAttribute).toBe(setAttribute)
  })

  it('changes nothing without a nonce', async () => {
    const create = document.createElement
    await withCspNonce(async () => expect(document.createElement).toBe(create))
  })

  it('leaves parsed markup alone: an injected <style> gets no nonce', async () => {
    setCspNonce('n5')
    const host = document.createElement('div')
    await withCspNonce(async () => {
      host.innerHTML = '<style>p { color: red; }</style><p style="width: 3px">x</p>'
    })
    expect(host.querySelector('style')?.hasAttribute('nonce')).toBe(false)
  })
})

describe('mountSvg', () => {
  const svg =
    '<svg id="d" xmlns="http://www.w3.org/2000/svg" style="max-width: 120px;"><style>#d .node { fill: red; }</style>' +
    '<g class="node" style="opacity: 0.5"><text>A&nbsp;B</text></g></svg>'

  it('gives each <style> the nonce and applies style attributes through CSSOM', () => {
    setCspNonce('n3')
    const host = document.createElement('div')
    host.innerHTML = '<p>old</p>'
    mountSvg(host, svg)
    expect(host.querySelector('p')).toBeNull()
    const root = host.querySelector('svg#d') as SVGSVGElement
    expect(root.querySelector('style')?.getAttribute('nonce')).toBe('n3')
    expect(root.style.maxWidth).toBe('120px')
    expect((root.querySelector('g') as SVGGElement).style.opacity).toBe('0.5')
    expect(root.querySelector('text')?.textContent).toBe('A\u00a0B')
  })

  it('mounts without a nonce when the page has none', () => {
    const host = document.createElement('div')
    mountSvg(host, svg)
    expect(host.querySelector('style')?.hasAttribute('nonce')).toBe(false)
    expect((host.querySelector('svg') as SVGSVGElement).style.maxWidth).toBe('120px')
  })

  it('drops event-handler attributes', () => {
    const host = document.createElement('div')
    mountSvg(host, '<svg onload="alert(1)"><image href="x" onerror="alert(2)" ONclick="alert(3)"/></svg>')
    expect(host.querySelector('svg')?.hasAttribute('onload')).toBe(false)
    const image = host.querySelector('image')!
    expect(image.getAttributeNames().filter((n) => n.startsWith('on'))).toEqual([])
    expect(image.getAttribute('href')).toBe('x')
  })

  it('removes denied elements from the SVG and keeps nonce-stamping its own <style>', () => {
    setCspNonce('n7')
    const host = document.createElement('div')
    mountSvg(host, '<svg><style>.a{}</style><script>window.y = 1</script><foreignObject><iframe src="x"></iframe></foreignObject><a href="/x"><text>t</text></a></svg>')
    expect(host.querySelector('script, iframe')).toBeNull()
    expect(host.querySelector('style')?.getAttribute('nonce')).toBe('n7')
    expect(host.querySelector('text')?.textContent).toBe('t')
  })

  it('mounts nothing when the markup is not an svg', () => {
    const host = document.createElement('div')
    host.innerHTML = '<p>old</p>'
    mountSvg(host, '<img src=x onerror="alert(1)">')
    expect(host.childNodes.length).toBe(0)
  })
})

describe('mountHtml', () => {
  it('replaces the contents and applies each style attribute through CSSOM', () => {
    const host = document.createElement('div')
    host.innerHTML = '<p>old</p>'
    mountHtml(host, '<table><tr><td style="text-align: right; padding: 6px">a</td></tr></table><b style="color: red">b</b> c')
    expect(host.querySelector('p')).toBeNull()
    const td = host.querySelector('td') as HTMLTableCellElement
    expect(td.style.textAlign).toBe('right')
    expect(td.style.padding).toBe('6px')
    expect((host.querySelector('b') as HTMLElement).style.color).toBe('red')
    expect(host.textContent).toBe('ab c')
  })

  it('removes every denied element and every event handler, anywhere in the tree', () => {
    const host = document.createElement('div')
    mountHtml(
      host,
      '<div onclick="a()"><p ONMOUSEOVER="b()" title="t">x<script>window.x = 1</script></p>' +
        '<base href="https://e.example/"><meta http-equiv="refresh" content="0"><link rel="stylesheet" href="https://e.example/s.css">' +
        '<iframe src="https://e.example"></iframe><frame><object data="x"></object><embed src="x"><noscript><img src=x></noscript>' +
        '<template><img src=x onerror="c()"></template><img src="/a.png" onerror="d()"><style>p{}</style></div>',
    )
    expect(host.querySelector('script, base, meta, link, iframe, frame, object, embed, noscript, template, style')).toBeNull()
    for (const el of Array.from(host.querySelectorAll('*'))) {
      expect(el.getAttributeNames().filter((n) => n.toLowerCase().startsWith('on')), el.localName).toEqual([])
    }
    expect(host.querySelector('p')?.getAttribute('title')).toBe('t')
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/a.png')
  })

  it('mounts body content only, never head-level content', () => {
    const host = document.createElement('div')
    mountHtml(host, '<title>t</title><style>p{}</style><link rel="x"><p>x</p>')
    expect(host.innerHTML).toBe('<p>x</p>')
    mountHtml(host, '<!doctype html><html><head><meta charset="utf-8"><style>p{}</style></head><body><b>y</b></body></html>')
    expect(host.innerHTML).toBe('<b>y</b>')
  })

  it('keeps going past an element with no style object', () => {
    const host = document.createElement('div')
    mountHtml(host, '<math style="color: red"><mi>x</mi></math><span style="color: blue">s</span>')
    expect((host.querySelector('span') as HTMLElement).style.color).toBe('blue')
  })
})

describe('styles.css', () => {
  it('ships the .wiki-md prose rules MDText relied on a runtime <style> for', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'global.css'), 'utf-8')
    for (const selector of ['.wiki-md {', '.wiki-md h1 {', '.wiki-md h2 {', '.wiki-md code {', '.wiki-md pre {', '.wiki-md table {', '.wiki-md blockquote {']) {
      expect(css).toContain(selector)
    }
    expect(css.match(/--wiki-code-border:/g)?.length).toBe(2)
  })
})
