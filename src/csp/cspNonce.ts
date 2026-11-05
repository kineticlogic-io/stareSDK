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
import { applyLiftedStyle } from './applyLiftedStyle.js'

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

/** Elements that never survive a mount: they can run, load, navigate, submit or animate an
 *  attribute into something else, or carry inert content (`template`) whose own tree would escape
 *  the walk. Matched by lower-cased local name (SVG's `animateTransform` included). Removed in the
 *  inert document, with their contents, before anything is imported. Defence in depth only: the
 *  input is already sanitised. */
const DENIED_ELEMENTS = new Set([
  'script', 'base', 'meta', 'link', 'iframe', 'frame', 'object', 'embed', 'noscript', 'template',
  'animate', 'set', 'animatetransform', 'animatemotion', 'fencedframe', 'portal',
])

/** Attributes that tie a control to a form or override where/how it submits: dropped from every
 *  element (a `<form>` itself is unwrapped, its content kept). */
const FORM_ATTRIBUTES = new Set(['form', 'formaction', 'formtarget', 'formmethod'])

/** Attributes holding a URL a browser may navigate to or load. */
const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction'])

/** True for a URL value that could run script or render a document when followed or loaded:
 *  `javascript:`, `vbscript:`, or any `data:` URL except a non-SVG `data:image/*` (so
 *  `data:text/html`, `application/xhtml+xml`, `text/xml` and `image/svg+xml` all count). Resolved
 *  the way the browser resolves it (WHATWG URL parsing against the page), so tabs, newlines and
 *  case cannot hide the scheme. */
function isScriptingUrl(value: string): boolean {
  try {
    const url = new URL(value, document.baseURI)
    if (url.protocol === 'javascript:' || url.protocol === 'vbscript:') return true
    if (url.protocol !== 'data:') return false
    const mime = url.pathname.split(/[;,]/, 1)[0].trim().toLowerCase()
    return !(mime.startsWith('image/') && mime !== 'image/svg+xml')
  } catch {
    return false
  }
}

/** On an SVG element other than `<a>`, an `href`/`xlink:href` that is not a same-document
 *  fragment (`#id`) — the reference by which `<use>`, `<feImage>`, `<pattern>`, gradients,
 *  `<filter>`, `<textPath>` and `<mpath>` pull in another document. */
function isExternalSvgReference(el: Element, name: string): boolean {
  if (el.namespaceURI !== SVG_NS || el.localName === 'a') return false
  if (name !== 'href' && name !== 'xlink:href') return false
  return !(el.getAttribute(name) ?? '').trim().startsWith('#')
}



/**
 * The one strip / lift / re-apply pipeline behind `mountSvg` and `mountHtml` — it makes markup
 * that is ALREADY sanitised compatible with a strict policy; it is not a sanitiser. In the inert
 * document `root` was parsed into, as defence in depth: denied elements (and `<style>` elements,
 * unless `keepStyleElements`) and any `<use>` of another document are removed, and `<form>`s
 * unwrapped; every `on…` and form attribute, every scripting URL (`javascript:`, `vbscript:`, any
 * `data:` but a non-SVG image) in `href`, `xlink:href`, `src`, `action` or `formaction`, and any
 * external SVG reference (`isExternalSvgReference`) is dropped. Then each kept `<style>` is given
 * `nonce` when there is one and each `style` attribute is lifted off. `root` is imported into
 * this document and the two trees are walked in lockstep, each copy given its source's lifted
 * style through CSSOM (`.style.cssText`), which a policy never restricts; an element with no
 * `.style` (MathML in some engines) keeps none. Returns the imported copy of `root`.
 */
function sanitizeAndImport(root: Element, options: { keepStyleElements: boolean; nonce?: string }): Element {
  const doc = root.ownerDocument
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const name = el.localName.toLowerCase()
    const externalUse = name === 'use' && ['href', 'xlink:href'].some((a) => el.hasAttribute(a) && isExternalSvgReference(el, a))
    if (DENIED_ELEMENTS.has(name) || (!options.keepStyleElements && name === 'style') || externalUse) el.remove()
    // A form is unwrapped: the element goes, its content stays.
    else if (name === 'form' && el.namespaceURI !== SVG_NS) el.replaceWith(...Array.from(el.childNodes))
  }
  const lifted = new Map<Element, string>()
  const sources = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  for (let el: Element | null = root; el; el = sources.nextNode() as Element | null) {
    for (const name of el.getAttributeNames()) {
      const lower = name.toLowerCase()
      if (lower.startsWith('on') || FORM_ATTRIBUTES.has(lower)) el.removeAttribute(name)
      else if (URL_ATTRIBUTES.has(lower) && isScriptingUrl(el.getAttribute(name) ?? '')) el.removeAttribute(name)
      else if (isExternalSvgReference(el, lower)) el.removeAttribute(name)
    }
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
    if (style) applyLiftedStyle(c as Element, style)
  }
  return copy
}

/**
 * Put an SVG document (a string, as mermaid returns it) into `host`, replacing its contents, in
 * a form a strict policy allows: each `<style>` gets the nonce, and each `style` attribute —
 * which no nonce can allow — is applied through the element's `style` property instead.
 *
 * The input must ALREADY be safe (for diagrams, Mermaid's `securityLevel: 'strict'` output):
 * this is not a sanitiser. As defence in depth it is parsed in an inert document, and scripts,
 * `<link>` elements, embeds, frames, SVG animation elements, external SVG references, event-handler
 * (`on…`) and form attributes and scripting URLs are removed and forms unwrapped before it is
 * mounted; `<a>` hyperlinks are kept. Markup that is not an `<svg>` root mounts nothing.
 */
export function mountSvg(host: Element, svg: string): void {
  // Parsed as HTML, as `innerHTML` would: mermaid's markup is HTML-serialised, not always XML.
  const root = new DOMParser().parseFromString(svg, 'text/html').body.firstElementChild
  host.replaceChildren()
  if (root?.localName !== 'svg') return
  host.appendChild(sanitizeAndImport(root, { keepStyleElements: true, nonce: getCspNonce() }))
}

/**
 * Put HTML into `host`, replacing its contents, in a form a strict policy allows — the HTML twin of
 * `mountSvg`, through the same pipeline: each `style` attribute is applied through CSSOM.
 *
 * The input must ALREADY be sanitised (for example with DOMPurify): this is not a sanitiser. As
 * defence in depth it is parsed in an inert document, and scripts, `<link>` elements, embeds,
 * frames, `<template>`, `<style>` elements (an un-nonced stylesheet would only be refused),
 * event-handler and form attributes and scripting URLs are removed and forms unwrapped (their
 * content kept); `<a>` hyperlinks are kept. Only the
 * body is mounted: head-level content — a leading `<style>`, `<link>`, `<meta>` or `<title>`, or
 * the `<head>` of a full HTML document — is not.
 */
export function mountHtml(host: Element, html: string): void {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  const copy = sanitizeAndImport(body, { keepStyleElements: false })
  // One atomic replacement of the live host.
  host.replaceChildren(...Array.from(copy.childNodes))
}
