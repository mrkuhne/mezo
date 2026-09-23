import { render } from '@testing-library/react'
import { CaptureArt, CAPTURE_ART, type CaptureKind } from '@/shared/ui/CaptureArt'

// Üveg (mezo-me75u.3, bible §4 + restored bible rule 28): ONE map dresses every capture header and
// the quick-log tile that opens it in the same Titanium 3D mark.
test('every capture kind renders its decorative 3D sprite symbol', () => {
  const expected: Record<CaptureKind, string> = {
    food: 't-bowl', water: 't-water', stack: 't-supps', training: 't-dumbbell', sport: 't-volley',
    weight: 't-weight', checkin: 't-checkin', journal: 't-journal', sleep: 't-sleep', chat: 't-chat',
    quick: 't-quick', activity: 't-steps',
  }
  expect(CAPTURE_ART).toEqual(expected)
  for (const [kind, symbol] of Object.entries(expected)) {
    const { container, unmount } = render(<CaptureArt kind={kind as CaptureKind} />)
    const svg = container.querySelector('svg.t-ico.capture-art')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '68')
    expect(svg!.querySelector('use')).toHaveAttribute('href', `#${symbol}`)
    unmount()
  }
})
