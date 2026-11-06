/** Apply a lifted `style` attribute to `target` through CSSOM, when it has a style object at all
 *  (an engine may give none to MathML); otherwise it simply keeps no style. Internal to
 *  `cspNonce.ts`'s mount pipeline; not exported from the package. */
export function applyLiftedStyle(target: Element, css: string): void {
  const style = (target as Partial<ElementCSSInlineStyle>).style
  if (style) style.cssText = css
}
