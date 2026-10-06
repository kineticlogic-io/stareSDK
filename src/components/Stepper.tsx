import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { TbAlertTriangle, TbCheck } from 'react-icons/tb'

/**
 * Stepper — compact horizontal step header for multi-step flows such as a wizard
 * (stareSDK, operator-approved 2026-09-25).
 *
 * Presentational: the caller owns the current step and renders the step body and the
 * back/next buttons (with the shared `Button`). Each step shows a 20px marker and a 12px label
 * on one line, joined by 1px connectors — sized to sit in a panel header, not dominate it.
 *
 * Step states: `complete` (check mark, accent), `current` (accent ring, primary label),
 * `upcoming` (muted), `error` (warning triangle in `--color-destructive`, which the caller sets
 * when that step failed validation). A step is clickable only if `onStepClick` is given and the
 * step is `complete` or `error` — users can go back to fix things but cannot skip ahead of
 * validation. The current step carries `aria-current="step"`.
 */

export type StepStatus = 'complete' | 'current' | 'upcoming' | 'error'

export interface StepItem {
  id: string
  label: string
  status: StepStatus
}

export interface StepperProps {
  steps: StepItem[]
  onStepClick?: (id: string) => void
  'aria-label': string
  style?: CSSProperties
}

const MARKER = 20

/** Screen-reader-only text (the standard clip pattern; no sr-only class exists in the SDK). */
const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

function markerStyle(status: StepStatus): CSSProperties {
  const base: CSSProperties = {
    width: MARKER,
    height: MARKER,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    boxSizing: 'border-box',
  }
  switch (status) {
    case 'complete':
      return { ...base, background: 'var(--color-accent)', color: 'var(--text-inverse)' }
    case 'current':
      return { ...base, border: '2px solid var(--color-accent)', color: 'var(--color-text-primary)' }
    case 'error':
      return { ...base, border: '2px solid var(--color-destructive)', color: 'var(--color-destructive)' }
    default:
      return { ...base, border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }
  }
}

export function Stepper({ steps, onStepClick, 'aria-label': ariaLabel, style }: StepperProps) {
  return (
    <ol
      aria-label={ariaLabel}
      style={{ display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none', margin: 0, padding: 0, ...style }}
    >
      {steps.map((step, i) => {
        const clickable = !!onStepClick && (step.status === 'complete' || step.status === 'error')
        const content = (
          <>
            <span aria-hidden style={markerStyle(step.status)}>
              {step.status === 'complete' ? (
                <TbCheck size={12} />
              ) : step.status === 'error' ? (
                <TbAlertTriangle size={12} />
              ) : (
                i + 1
              )}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: step.status === 'current' ? 600 : 500,
                color:
                  step.status === 'upcoming'
                    ? 'var(--text-muted)'
                    : step.status === 'error'
                      ? 'var(--color-destructive)'
                      : 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {step.label}
              {step.status === 'error' && <span style={SR_ONLY}> (needs attention)</span>}
              {step.status === 'complete' && <span style={SR_ONLY}> (complete)</span>}
            </span>
          </>
        )
        return (
          <Fragment key={step.id}>
            {i > 0 && (
              <li aria-hidden style={{ flex: '1 1 16px', minWidth: 12, maxWidth: 48, height: 1, background: 'var(--color-glass-border)' }} />
            )}
            <li aria-current={step.status === 'current' ? 'step' : undefined} style={{ position: 'relative' }}>
              {clickable ? (
                <button
                  type="button"
                  className="ui-stepper__step"
                  onClick={() => onStepClick(step.id)}
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {content}
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{content}</span>
              )}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
