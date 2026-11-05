/**
 * The page's Content Security Policy nonce, for the `<style>` elements stareSDK makes.
 *
 * A consumer that serves a strict policy (`style-src 'self' 'nonce-…'`, no `'unsafe-inline'`)
 * refuses every `<style>` without the page load's nonce (W3C Content Security Policy Level 3,
 * `style-src`: https://www.w3.org/TR/CSP3/#directive-style-src). stareSDK's CSS ships in
 * `styles.css`; the styles made at runtime — CodeMirror's (CodeEditor) and mermaid's (MDText
 * diagrams) — take the nonce from here:
 *
 * - `setCspNonce(nonce)`, when the app knows it; else
 * - the page's `<meta property="csp-nonce" nonce="…">`, the tag Vite's `html.cspNonce` writes,
 *   so a Vite app whose server fills in that placeholder needs no code at all.
 *
 * No nonce (no policy, or a test): the styles are made as before.
 */
let explicit: string | undefined

/** Set (or with `undefined`, clear) the nonce stareSDK gives its `<style>` elements. */
export function setCspNonce(nonce: string | undefined): void {
  explicit = nonce || undefined
}

/** The nonce stareSDK gives its `<style>` elements, or `undefined` when the page has none. */
export function getCspNonce(): string | undefined {
  if (explicit) return explicit
  if (typeof document === 'undefined') return undefined
  const meta = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')
  // Browsers hide a nonce attribute once the element is in the document (HTML's nonce hiding:
  // https://html.spec.whatwg.org/multipage/urls-and-fetching.html#nonce-attributes); the
  // `nonce` property keeps it.
  return meta?.nonce || meta?.getAttribute('nonce') || undefined
}

const HTML_NS = 'http://www.w3.org/1999/xhtml'
const SVG_NS = 'http://www.w3.org/2000/svg'

/** An HTML or SVG `<style>`, told apart by name and namespace rather than by interface, which
 *  not every DOM implementation exposes (jsdom has no `SVGStyleElement`). */
function isStyleElement(el: Element): boolean {
  return el.localName === 'style' && (el.namespaceURI === HTML_NS || el.namespaceURI === SVG_NS)
}

let depth = 0
let restore: (() => void) | undefined

/**
 * Run `work` in a form a strict policy allows, for a library that styles through the DOM and
 * takes no nonce (mermaid measures a diagram against a `<style>` it adds to the page, and sets
 * `style` attributes as it lays it out). While it runs:
 * - every `<style>` (HTML or SVG) a script makes with `document.createElement` or
 *   `document.createElementNS` gets the nonce;
 * - a `style` attribute a script sets with `setAttribute` is applied through the element's
 *   `style` property (CSSOM) instead, which a policy never restricts.
 * Only what scripts do is changed: markup injected into the page is parsed, not made this way,
 * so an injected `<style>` or `style` attribute is still refused. Nested and overlapping calls
 * share one set of wrappers, removed when the last of them ends.
 */
export async function withCspNonce<T>(work: () => Promise<T>): Promise<T> {
  const nonce = getCspNonce()
  if (!nonce || typeof document === 'undefined') return work()
  if (depth++ === 0) {
    const create = document.createElement
    const createNS = document.createElementNS
    const setAttribute = Element.prototype.setAttribute
    document.createElement = function (this: Document, tag: string, options?: ElementCreationOptions) {
      const el = create.call(this, tag, options)
      if (isStyleElement(el)) setAttribute.call(el, 'nonce', nonce)
      return el
    } as typeof document.createElement
    document.createElementNS = function (
      this: Document,
      namespace: string | null,
      name: string,
      options?: string | ElementCreationOptions,
    ) {
      const el = createNS.call(this, namespace, name, options as ElementCreationOptions)
      if (isStyleElement(el)) setAttribute.call(el, 'nonce', nonce)
      return el
    } as typeof document.createElementNS
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      if (name.toLowerCase() === 'style' && (this instanceof HTMLElement || this instanceof SVGElement)) {
        this.style.cssText = String(value)
        return
      }
      setAttribute.call(this, name, value)
    }
    restore = () => {
      document.createElement = create
      document.createElementNS = createNS
      Element.prototype.setAttribute = setAttribute
    }
  }
  try {
    return await work()
  } finally {
    if (--depth === 0) {
      restore?.()
      restore = undefined
    }
  }
}

/** Elements that never survive a mount: they can run, load, navigate, or carry inert content
 *  (`template`) whose own tree would escape the walk. Removed in the inert document, with their
 *  contents, before anything is imported. */
const DENIED_ELEMENTS = ['script', 'base', 'meta', 'link', 'iframe', 'frame', 'object', 'embed', 'noscript', 'template']

/**
 * The one strip / lift / re-apply pipeline behind `mountSvg` and `mountHtml`. In the inert
 * document `root` was parsed into: denied elements (and `<style>` elements, unless
 * `keepStyleElements`) are removed; every `on…` attribute is dropped; each kept `<style>` is given
 * `nonce` when there is one; each `style` attribute is lifted off. `root` is then imported into this document and
 * the two trees are walked in lockstep, each copy given its source's lifted style through CSSOM
 * (`.style.cssText`), which a policy never restricts. An element with no `.style` (MathML in some
 * engines) simply keeps none. Returns the imported copy of `root`.
 */
function sanitizeAndImport(root: Element, options: { keepStyleElements: boolean; nonce?: string }): Element {
  const denied = options.keepStyleElements ? DENIED_ELEMENTS : [...DENIED_ELEMENTS, 'style']
  root.querySelectorAll(denied.join(',')).forEach((el) => el.remove())
  const lifted = new Map<Element, string>()
  const doc = root.ownerDocument
  const sources = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  for (let el: Element | null = root; el; el = sources.nextNode() as Element | null) {
    for (const name of el.getAttributeNames()) if (name.toLowerCase().startsWith('on')) el.removeAttribute(name)
    if (options.nonce && el.localName === 'style') el.setAttribute('nonce', options.nonce)
    const style = el.getAttribute('style')
    if (style !== null) {
      lifted.set(el, style)
      el.removeAttribute('style')
    }
  }
  const copy = document.importNode(root, true)
  const from = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  const to = document.createTreeWalker(copy, NodeFilter.SHOW_ELEMENT)
  for (let s: Node | null = root, c: Node | null = copy; s && c; s = from.nextNode(), c = to.nextNode()) {
    const style = lifted.get(s as Element)
    const target = (c as Partial<ElementCSSInlineStyle>).style
    if (style && target) target.cssText = style
  }
  return copy
}

/**
 * Put an SVG document (a string, as mermaid returns it) into `host`, replacing its contents,
 * in a form a strict policy allows: each `<style>` gets the nonce, and each `style` attribute —
 * which no nonce can allow — is applied through the element's `style` property instead.
 * The SVG is parsed in an inert document, never run; scripts, links, embeds, frames and other
 * denied elements are removed and any event-handler (`on…`) attribute is dropped before it is
 * mounted, so nothing in it executes. Markup that is not an `<svg>` root mounts nothing.
 */
export function mountSvg(host: Element, svg: string): void {
  // Parsed as HTML, as `innerHTML` would: mermaid's markup is HTML-serialised, not always XML.
  const root = new DOMParser().parseFromString(svg, 'text/html').body.firstElementChild
  host.replaceChildren()
  if (root?.localName !== 'svg') return
  host.appendChild(sanitizeAndImport(root, { keepStyleElements: true, nonce: getCspNonce() }))
}

/**
 * Put HTML that has ALREADY been sanitised (a string; parsed here, never trusted to be safe) into
 * `host`, replacing its contents, in a form a strict policy allows — the HTML twin of `mountSvg`,
 * through the same pipeline: parsed in an inert document; scripts, links, embeds, frames,
 * `<template>` and other denied elements removed; every `on…` attribute dropped; each `style`
 * attribute applied through CSSOM. `<style>` elements are removed too: this is for content from
 * outside the app, and an un-nonced stylesheet would only be refused. Only the body is mounted:
 * head-level content — a leading `<style>`, `<link>`, `<meta>` or `<title>`, or the `<head>` of a
 * full HTML document — is not.
 */
export function mountHtml(host: Element, html: string): void {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  const copy = sanitizeAndImport(body, { keepStyleElements: false })
  const fragment = document.createDocumentFragment()
  fragment.append(...Array.from(copy.childNodes))
  host.replaceChildren(fragment)
}
