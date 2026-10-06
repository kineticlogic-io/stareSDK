// Mounts the guide's live examples. One React root holds the providers (theme, toasts, dock), and
// each example renders through a portal into its `[data-demo]` slot in the static page, so every
// example shares the same theme and the page reads fine before the script runs.
import '../../src/styles/global.css'
import './site.css'
import { StrictMode, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { TbList, TbMoon, TbSun } from 'react-icons/tb'
import { Button, DockProvider, ThemeProvider, ToastProvider, useTheme } from '../../src/index'
import { DEMOS } from './demos'

const INITIAL_TITLE = document.title

/** The header's theme switch. Honors the system setting until the reader picks one. */
function ThemeSwitch() {
  const { theme, setTheme, commitTheme } = useTheme()
  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem('theme') } catch { /* private mode */ }
    if (stored === 'dark' || stored === 'light') return
    const query = matchMedia('(prefers-color-scheme: light)')
    const follow = () => setTheme(query.matches ? 'light' : 'dark')
    follow()
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [setTheme])
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <Button
      variant="ghost"
      size="xs"
      icon={theme === 'dark' ? <TbSun /> : <TbMoon />}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => commitTheme(next)}
    />
  )
}

/** Shows the contents rail on narrow screens, where it is collapsed by default. */
function RailToggle() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const rail = document.getElementById('guide-rail')
    if (!rail) return
    rail.dataset.open = String(open)
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.toc-link')) setOpen(false)
    }
    rail.addEventListener('click', close)
    return () => rail.removeEventListener('click', close)
  }, [open])
  return (
    <span className="rail-toggle">
      <Button
        variant="ghost"
        size="xs"
        icon={<TbList />}
        active={open}
        aria-label="Contents"
        title="Contents"
        aria-expanded={open}
        aria-controls="guide-rail"
        onClick={() => setOpen(o => !o)}
      />
    </span>
  )
}

/** Marks the contents entry for the section being read. */
function useScrollSpy() {
  useEffect(() => {
    const links = new Map<string, HTMLAnchorElement>()
    document.querySelectorAll<HTMLAnchorElement>('.toc-link').forEach(a => links.set(a.hash.slice(1), a))
    const headings = [...document.querySelectorAll<HTMLElement>('.guide-heading')]
    let current: HTMLAnchorElement | undefined
    const update = () => {
      const offset = 90
      let active = headings[0]
      for (const h of headings) {
        if (h.getBoundingClientRect().top - offset <= 0) active = h
        else break
      }
      const link = active && links.get(active.id)
      if (link === current) return
      current?.removeAttribute('aria-current')
      link?.setAttribute('aria-current', 'true')
      if (link) {
        const rail = document.getElementById('guide-rail')
        const r = link.getBoundingClientRect()
        const rr = rail?.getBoundingClientRect()
        if (rail && rr && (r.top < rr.top || r.bottom > rr.bottom)) link.scrollIntoView({ block: 'nearest' })
      }
      current = link
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
}

function Guide() {
  useScrollSpy()
  // The examples render after the browser has jumped to a `#section` link and push it down the
  // page, so land on it again once they are in.
  useEffect(() => {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (target) requestAnimationFrame(() => target.scrollIntoView())
  }, [])
  // PageHeader sets document.title; the guide keeps its own. This parent effect runs after the
  // examples' effects on mount.
  useEffect(() => {
    document.title = INITIAL_TITLE
  })
  const slots = [...document.querySelectorAll<HTMLElement>('[data-demo]')]
  const header = document.getElementById('header-actions')
  const portals: ReactNode[] = []
  for (const slot of slots) {
    const name = slot.dataset.demo as string
    const Demo = DEMOS[name]
    if (!Demo) {
      console.warn(`No example named "${name}"`)
      continue
    }
    portals.push(createPortal(<Suspense fallback={null}><Demo /></Suspense>, slot, name))
  }
  return (
    <>
      {header && createPortal(<><RailToggle /><ThemeSwitch /></>, header)}
      {portals}
    </>
  )
}

const host = document.createElement('div')
document.body.appendChild(host)
createRoot(host).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <DockProvider>
          <Guide />
        </DockProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
