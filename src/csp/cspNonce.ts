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

function isStyleElement(el: Element): boolean {
  return el instanceof HTMLStyleElement || el instanceof SVGStyleElement
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

/**
 * Put an SVG document (a string, as mermaid returns it) into `host`, replacing its contents,
 * in a form a strict policy allows: each `<style>` gets the nonce, and each `style` attribute —
 * which no nonce can allow — is applied through the element's `style` property instead.
 * The SVG is parsed in an inert document, never run, and any event-handler (`on…`) attribute is
 * dropped before it is mounted, so nothing in it executes. Markup that is not an `<svg>` root
 * mounts nothing.
 */
export function mountSvg(host: Element, svg: string): void {
  // Parsed as HTML, as `innerHTML` would: mermaid's markup is HTML-serialised, not always XML.
  const root = new DOMParser().parseFromString(svg, 'text/html').body.firstElementChild
  host.replaceChildren()
  if (root?.localName !== 'svg') return
  const nonce = getCspNonce()
  const sources = [root, ...Array.from(root.querySelectorAll('*'))]
  const inline = sources.map((el) => {
    if (nonce && el.localName === 'style') el.setAttribute('nonce', nonce)
    for (const name of el.getAttributeNames()) if (name.toLowerCase().startsWith('on')) el.removeAttribute(name)
    const style = el.getAttribute('style')
    el.removeAttribute('style')
    return style
  })
  const node = document.importNode(root, true)
  // importNode copies the tree in document order, so the same walk pairs each copy with its source.
  const copies = [node, ...Array.from(node.querySelectorAll('*'))]
  copies.forEach((copy, i) => {
    const style = inline[i]
    if (style) (copy as HTMLElement | SVGElement).style.cssText = style
  })
  host.appendChild(node)
}
