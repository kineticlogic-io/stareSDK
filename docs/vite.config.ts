// Builds the stareSDK component guide (GitHub Pages) from `docs/src/` into `docs/`:
//
//   npm run docs
//
// The page is the CODEX reading layout OpenStare's user guide and OpenTrack's help tab use: a
// contents rail beside the guide, on the Elite Command tokens. Its live examples are the real
// components, imported from `src/`, so the guide always shows what this checkout ships.
//
// `docs/index.html` and `docs/assets/` are generated: edit `docs/src/` and rebuild.
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string }

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** GitHub's slug rule: lowercase, keep letters, digits, spaces, hyphens and underscores. */
const slugOf = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/ /g, '-')

/**
 * Gives every `<h2>`/`<h3>` in the guide an anchor and a hover `#` link, and writes the contents
 * rail from them in place of `<!-- toc -->` (the same treatment as OpenStare's user guide build).
 * `__VERSION__` becomes the package version.
 */
function contentsRail(): Plugin {
  return {
    name: 'staresdk-contents-rail',
    transformIndexHtml(html) {
      const seen = new Map<string, number>()
      const headings: { depth: number; text: string; id: string }[] = []
      const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, depth: string, inner: string) => {
        const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
        const base = slugOf(text)
        const n = seen.get(base) ?? 0
        seen.set(base, n + 1)
        const id = n === 0 ? base : `${base}-${n}`
        headings.push({ depth: Number(depth), text, id })
        return `<h${depth} id="${id}" class="guide-heading">${inner}<a class="guide-anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>`
      })
      let toc = ''
      let open = false
      for (const h of headings) {
        if (h.depth === 2) {
          if (open) toc += '</div>'
          toc += `<a class="toc-link" href="#${h.id}">${escapeHtml(h.text)}</a><div class="toc-sub">`
          open = true
        } else {
          toc += `<a class="toc-link toc-link--sub" href="#${h.id}">${escapeHtml(h.text)}</a>`
        }
      }
      if (open) toc += '</div>'
      return out.replace('<!-- toc -->', toc).replaceAll('__VERSION__', version)
    },
  }
}

/** `docs/` also holds the sources, so only the previous build's output is cleared. */
function cleanOutput(): Plugin {
  return {
    name: 'staresdk-clean-docs-output',
    buildStart() {
      rmSync(join(here, 'assets'), { recursive: true, force: true })
      for (const f of readdirSync(here)) if (f === 'index.html') rmSync(join(here, f))
    },
  }
}

export default defineConfig({
  root: join(here, 'src'),
  base: './',
  publicDir: false,
  plugins: [cleanOutput(), contentsRail()],
  build: {
    outDir: here,
    emptyOutDir: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // framer-motion's "use client" directives mean nothing outside a server-components build.
      onwarn(warning, warn) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning)
      },
    },
  },
})
