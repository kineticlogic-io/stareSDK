// @vitest-environment jsdom
/**
 * FileDropZone.test.tsx — Phase 80.2 Plan 04, Task 3.
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (matches the rest of the
 * codebase's component test convention — no @testing-library/react dependency, see
 * SortableList.test.tsx / Toast.test.tsx). `drop` and `keydown` are real native DOM events
 * dispatched at the `role="button"` target; a fake minimal `DataTransfer`-shaped object is
 * attached to the drop event since jsdom does not implement drag-and-drop natively.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { FileDropZone } from './FileDropZone.js'
import type { FileDropZoneProps } from './FileDropZone.js'

function makeFile(name: string, type = 'text/plain'): File {
  return new File(['content'], name, { type })
}

function dispatchDrop(target: Element, file: File | null) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: file ? [file] : [] },
  })
  act(() => { target.dispatchEvent(event) })
}

function dispatchKeyDown(target: Element, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => { target.dispatchEvent(event) })
}

function renderZone(props: Partial<FileDropZoneProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onFileChange = vi.fn()
  const onReject = vi.fn()

  const defaults: FileDropZoneProps = {
    inputId: 'test-drop-zone',
    accept: '.png,.jpg',
    acceptedExtensions: ['png', 'jpg'],
    file: null,
    onFileChange,
    onReject,
    ...props,
  }

  act(() => {
    root.render(<FileDropZone {...defaults} />)
  })

  const target = container.querySelector('[role="button"]') as HTMLElement

  return {
    container,
    target,
    onFileChange,
    onReject,
    unmount: () => { act(() => { root.unmount() }); container.remove() },
  }
}

describe('FileDropZone', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
    vi.restoreAllMocks()
  })

  it('drop_path_rejects_disallowed_extension', () => {
    const { target, onFileChange, onReject, unmount } = renderZone()
    unmountFns.push(unmount)

    dispatchDrop(target, makeFile('notes.txt'))

    expect(onFileChange).toHaveBeenCalledWith(null)
    expect(onReject).toHaveBeenCalledTimes(1)
    const message = onReject.mock.calls[0][0] as string
    expect(message).toContain('.txt')
    expect(message).toContain('.png')
    expect(message).toContain('.jpg')
  })

  it('drop_path_accepts_allowed_extension', () => {
    const { target, onFileChange, onReject, unmount } = renderZone({ acceptedExtensions: ['png', 'jpg'] })
    unmountFns.push(unmount)

    const file = makeFile('photo.png')
    dispatchDrop(target, file)

    expect(onFileChange).toHaveBeenCalledWith(file)
    expect(onReject).not.toHaveBeenCalled()
  })

  it('extension_check_is_case_insensitive', () => {
    const { target, onFileChange, onReject, unmount } = renderZone({ acceptedExtensions: ['png', 'jpg'] })
    unmountFns.push(unmount)

    const file = makeFile('PHOTO.PNG')
    dispatchDrop(target, file)

    expect(onFileChange).toHaveBeenCalledWith(file)
    expect(onReject).not.toHaveBeenCalled()
  })

  it('keyboard_enter_opens_picker', () => {
    const { container, target, unmount } = renderZone()
    unmountFns.push(unmount)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    target.focus()
    dispatchKeyDown(target, 'Enter')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(input).toBeTruthy()
  })

  it('disabled_blocks_drop_and_keyboard', () => {
    const { target, onFileChange, unmount } = renderZone({ disabled: true })
    unmountFns.push(unmount)

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    dispatchDrop(target, makeFile('photo.png'))
    dispatchKeyDown(target, 'Enter')

    expect(onFileChange).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('progress_renders_a_busy_determinate_bar', () => {
    const { container, target, unmount } = renderZone({ progress: 42 })
    unmountFns.push(unmount)

    expect(container.textContent).toContain('42%')
    expect(target.getAttribute('aria-busy')).toBe('true')
  })

  it('selected_file_renders_name_and_replace_affordance', () => {
    const file = makeFile('boundary.geojson')
    const { container, unmount } = renderZone({ file, acceptedExtensions: ['geojson'] })
    unmountFns.push(unmount)

    expect(container.textContent).toContain('boundary.geojson')
    expect(container.textContent?.toLowerCase()).toContain('replace')
  })
})
