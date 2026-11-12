import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RangeSlider } from './RangeSlider'

function setup(minValue = 16, maxValue = 48) {
  const onChange = vi.fn()
  render(
    <RangeSlider
      minValue={minValue}
      maxValue={maxValue}
      onChange={onChange}
      min={8}
      max={96}
      ariaLabels={['Smallest cluster', 'Largest cluster']}
      formatValue={v => `${v} px`}
    />,
  )
  return onChange
}

describe('RangeSlider', () => {
  it('names each handle and formats the values', () => {
    setup()
    const lo = screen.getByRole('slider', { name: 'Smallest cluster' })
    const hi = screen.getByRole('slider', { name: 'Largest cluster' })
    expect(lo).toHaveAttribute('aria-valuetext', '16 px')
    expect(hi).toHaveAttribute('aria-valuetext', '48 px')
    expect(screen.getByText('16 px')).toBeInTheDocument()
    expect(screen.getByText('48 px')).toBeInTheDocument()
  })

  it('moves one handle and keeps the other', () => {
    const onChange = setup()
    fireEvent.change(screen.getByRole('slider', { name: 'Smallest cluster' }), { target: { value: '20' } })
    expect(onChange).toHaveBeenLastCalledWith(20, 48)
    fireEvent.change(screen.getByRole('slider', { name: 'Largest cluster' }), { target: { value: '60' } })
    expect(onChange).toHaveBeenLastCalledWith(16, 60)
  })

  it('never lets the handles cross', () => {
    const onChange = setup()
    fireEvent.change(screen.getByRole('slider', { name: 'Smallest cluster' }), { target: { value: '70' } })
    expect(onChange).toHaveBeenLastCalledWith(48, 48)
    fireEvent.change(screen.getByRole('slider', { name: 'Largest cluster' }), { target: { value: '10' } })
    expect(onChange).toHaveBeenLastCalledWith(16, 16)
  })
})
