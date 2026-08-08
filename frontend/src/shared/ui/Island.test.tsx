import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Island } from '@/shared/ui/Island'

const base = {
  tone: 'reggel' as const,
  nowRing: false,
  capsule: { emoji: '🌅', title: 'Reggel', essence: 'Mobilitás videó a következő', count: '3 ›' },
  ariaLabel: 'Reggel · Mobilitás videó a következő · megnyitás',
  onSelect: vi.fn(),
}

describe('Island', () => {
  it('capsule button carries the spoken label and fires onSelect', async () => {
    const onSelect = vi.fn()
    render(
      <Island {...base} big={false} onSelect={onSelect}>
        content
      </Island>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reggel · Mobilitás videó a következő · megnyitás' }))
    expect(onSelect).toHaveBeenCalled()
  })

  it('big island hides the capsule from the a11y tree and shows children', () => {
    render(
      <Island {...base} big>
        BIG CONTENT
      </Island>,
    )
    expect(screen.queryByRole('button', { name: /megnyitás/ })).toBeNull()
    expect(screen.getByText('BIG CONTENT')).toBeInTheDocument()
  })

  it('nowRing adds the now tag (default MOST) and the .now-clock class', () => {
    const { container } = render(
      <Island {...base} big={false} nowRing ariaLabel="Reggel · most · Mobilitás videó a következő · megnyitás">
        x
      </Island>,
    )
    expect(screen.getByText('MOST')).toBeInTheDocument()
    expect(container.querySelector('.isl.now-clock')).not.toBeNull()
  })

  it('nowRing honors a custom nowTag', () => {
    render(
      <Island {...base} big={false} nowRing capsule={{ ...base.capsule, nowTag: 'NOW' }}>
        x
      </Island>,
    )
    expect(screen.getByText('NOW')).toBeInTheDocument()
  })

  it('belt sets the .isl-belt class', () => {
    const { container } = render(
      <Island {...base} big={false} belt>
        x
      </Island>,
    )
    expect(container.querySelector('.isl.isl-belt')).not.toBeNull()
  })

  it('belt renders beltContent instead of the standard capsule row', () => {
    render(
      <Island {...base} big={false} belt beltContent={<span>1 160 kcal maradt</span>}>
        x
      </Island>,
    )
    expect(screen.getByText('1 160 kcal maradt')).toBeInTheDocument()
    expect(screen.queryByText(base.capsule.title)).toBeNull()
  })

  it('night flag darkens the shell', () => {
    const { container } = render(
      <Island {...base} tone="este" big night>
        x
      </Island>,
    )
    expect(container.querySelector('.isl.isl-night')).not.toBeNull()
  })

  it('exposes the tone via data-tone', () => {
    const { container } = render(
      <Island {...base} tone="fuel" big={false}>
        x
      </Island>,
    )
    expect(container.querySelector('.isl[data-tone="fuel"]')).not.toBeNull()
  })
})
