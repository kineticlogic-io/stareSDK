/**
 * FileDropZone — the project's ONLY file-upload/drop-zone component, authorized by the operator
 * in Phase 80.2 (`80.2-04-PLAN.md`). `UploadLayerModal` was migrated onto it in the same phase;
 * any future upload UI (e.g. the plan 07 wiki MEDIA tab) reuses this rather than hand-rolling a
 * second drop zone (CLAUDE.md shared-UI hard rule).
 *
 * SECURITY NOTE (threat T-80.2-04-01): the client-side extension check below is a UX affordance
 * ONLY — it is explicitly NOT a security control. A file renamed to pass the check (e.g. a
 * malicious payload renamed to `.geojson`) sails through it. The authoritative control is the
 * server-side magic-byte sniff on the written bytes performed by the backend ingest pipeline.
 * Do not mistake this component for a security boundary.
 *
 * This component never performs a network request and never renders an error itself — rejection
 * is surfaced via `onReject` and the consumer owns the error surface (e.g. an inline `ERROR:`
 * block). Do not add a second error-display convention to a future consumer of this component.
 */
import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { TbFile, TbUpload } from 'react-icons/tb'

export interface FileDropZoneProps {
  /** Stable DOM id for the hidden <input type="file"> and its <label htmlFor>. Required. */
  inputId: string
  /** `accept` attribute value — filters the BROWSE dialog only. */
  accept: string
  /** Lowercase extensions WITHOUT the dot. Validated on BOTH the drop and browse paths. */
  acceptedExtensions: string[]
  /** Controlled selection. The parent owns it. */
  file: File | null
  /** Emitted with the accepted File, or with null when the selection is cleared. */
  onFileChange: (file: File | null) => void
  /** Emitted with a human-readable reason when a candidate fails the extension check. */
  onReject?: (message: string) => void
  /** Blocks click / keyboard / drop interaction. */
  disabled?: boolean
  /** Uppercase field label above the zone. Omitted renders no label. */
  label?: string
  /** Helper copy below the zone (accepted formats, size limit). */
  hint?: string
  /** 0-100 determinate progress, or null/undefined for no bar. Renders a compositor-safe
   *  transform-scaled bar plus a percent readout inside the zone. */
  progress?: number | null
  /** Compact height (72px min) for inline/row contexts; default is the 110px full height. */
  compact?: boolean
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: 'var(--font-mono)',
  marginBottom: 4,
  display: 'block',
}

export function FileDropZone({
  inputId,
  accept,
  acceptedExtensions,
  file,
  onFileChange,
  onReject,
  disabled = false,
  label,
  hint,
  progress,
  compact = false,
}: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = typeof progress === 'number'

  // Single validation path for BOTH the drop and browse candidates — the `accept` attribute
  // filters only the browse dialog and has no effect on a dropped file, so both paths must run
  // the same extension check.
  function acceptCandidate(candidate: File | null) {
    if (!candidate) return
    const ext = candidate.name.split('.').pop()?.toLowerCase() ?? ''
    if (!acceptedExtensions.includes(ext)) {
      onFileChange(null)
      onReject?.(
        `Unsupported file type '.${ext}'. Accepted: ${acceptedExtensions.map(e => `.${e}`).join(', ')}`,
      )
      return
    }
    onFileChange(candidate)
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  const zoneStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-xs)',
    minHeight: compact ? 72 : 110,
    padding: compact ? 'var(--space-sm)' : 'var(--space-lg)',
    // dragOver state is a universal relative-lighten highlight (white wash), not a themed
    // surface — matches ui/Modal.tsx's scrim reasoning (89-UI-SPEC.md Component Contract §6).
    // Resting state uses --surface-layer-2 (D-15/89-12).
    // eslint-disable-next-line no-restricted-syntax -- dragOver highlight wash, see comment above
    background: dragOver ? 'rgba(255,255,255,0.06)' : 'var(--surface-layer-2)',
    border: `1.5px dashed ${dragOver ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
    borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
    textAlign: 'center',
    transition: 'background 0.12s, border-color 0.12s',
    opacity: busy ? 0.7 : 1,
    position: 'relative',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      {label && (
        <label htmlFor={inputId} style={labelStyle}>
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={e => {
          acceptCandidate(e.target.files?.[0] ?? null)
          // Reset so re-picking the SAME file re-fires `change` — required for the replace
          // affordance (drop/click the same file again to re-select it).
          e.target.value = ''
        }}
        style={{ display: 'none' }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-busy={busy}
        aria-label="Drag a file here or click to browse"
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={e => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled) acceptCandidate(e.dataTransfer.files?.[0] ?? null)
        }}
        style={zoneStyle}
      >
        {file ? (
          <>
            <TbFile size={22} style={{ color: 'var(--color-accent)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--color-text-primary)',
                wordBreak: 'break-all',
              }}
            >
              {file.name}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}>
              {(file.size / (1024 * 1024)).toFixed(2)} MB — drop or click to replace
            </span>
          </>
        ) : (
          <>
            <TbUpload size={22} style={{ color: 'var(--color-text-secondary)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-primary)' }}>
              Drag a file here or{' '}
              <span style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>click to browse</span>
            </span>
          </>
        )}
        {busy && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--space-xs)' }}>
            <div
              style={{
                width: '100%',
                height: 4,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-glass-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'var(--color-accent)',
                  transform: `scaleX(${(progress ?? 0) / 100})`,
                  transformOrigin: 'left',
                  transition: 'transform 0.15s',
                }}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}>
              {Math.round(progress ?? 0)}%
            </span>
          </div>
        )}
      </div>
      {hint && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
