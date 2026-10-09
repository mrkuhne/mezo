import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { expect, test } from 'vitest'
import { useBackNav, useBackTo, useLeaveAfterMutation } from '@/shared/hooks/useBackNav'

function Probe() {
  const { pathname } = useLocation()
  return <div data-testid="path">{pathname}</div>
}
function BackButton({ fallback }: { fallback: string }) {
  const goBack = useBackNav(fallback)
  return <button type="button" onClick={goBack}>vissza</button>
}

test('pops history when a previous in-app entry exists', () => {
  render(
    <MemoryRouter initialEntries={['/train/gym', '/train/session']} initialIndex={1}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackButton fallback="/train" />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'vissza' }))
  expect(screen.getByTestId('path')).toHaveTextContent('/train/gym')
})

test('deep link (first history entry) navigates to the fallback instead', () => {
  render(
    <MemoryRouter initialEntries={['/train/session']}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackButton fallback="/train" />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'vissza' }))
  expect(screen.getByTestId('path')).toHaveTextContent('/train')
})

// ── useBackTo (mezo-me75u.13): „vissza → ahonnan jöttél", a label says where it goes ──
function BackToButton({ fallback, label }: { fallback: string; label: string }) {
  const back = useBackTo(fallback, label)
  return <button type="button" data-via={String(back.viaHistory)} onClick={back.onBack}>‹ {back.label}</button>
}

test('useBackTo pops history to where the user came from and says the neutral Vissza', () => {
  render(
    <MemoryRouter initialEntries={['/mezo', '/mezo/patterns/x']} initialIndex={1}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackToButton fallback="/mezo/patterns" label="Minták" />} />
      </Routes>
    </MemoryRouter>,
  )
  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('‹ Vissza')
  expect(button).toHaveAttribute('data-via', 'true')
  fireEvent.click(button)
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/mezo$/)
})

test('useBackTo on a direct open names and opens the fallback list, search included', () => {
  render(
    <MemoryRouter initialEntries={['/mezo/patterns/x']}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackToButton fallback="/mezo/patterns?d=sleep" label="Minták" />} />
      </Routes>
    </MemoryRouter>,
  )
  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('‹ Minták')
  expect(button).toHaveAttribute('data-via', 'false')
  fireEvent.click(button)
  expect(screen.getByTestId('path')).toHaveTextContent('/mezo/patterns')
})

test('useBackTo treats the browser router first entry (idx 0) as a direct open even after a replace', () => {
  const saved = window.history.state
  window.history.replaceState({ idx: 0, key: 'abc', usr: null }, '')
  try {
    render(
      <MemoryRouter initialEntries={['/mezo/patterns', '/mezo/patterns/x']} initialIndex={1}>
        <Probe />
        <Routes>
          <Route path="*" element={<BackToButton fallback="/mezo/patterns" label="Minták" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('‹ Minták')
  } finally {
    window.history.replaceState(saved, '')
  }
})

// Fix round 2 (mezo-n4wf5.1): the hooks decide through the SHARED `canGoBack` helper — the browser
// router's `history.state.idx` outranks the location key, exactly as on the frame's title bar.
function withHistoryIdx(idx: number, run: () => void) {
  const prev = window.history.state
  window.history.replaceState({ ...(prev ?? {}), idx }, '')
  try { run() } finally { window.history.replaceState(prev, '') }
}
function LabelProbe({ fallback }: { fallback: string }) {
  const back = useBackTo(fallback, 'Minták')
  return <button type="button" onClick={back.onBack}>{back.label}</button>
}

test('idx 0 means "opened here": the fallback, even though the location key is not the initial one', () => {
  withHistoryIdx(0, () => {
    render(
      <MemoryRouter initialEntries={['/train/gym', '/train/session']} initialIndex={1}>
        <Probe />
        <Routes><Route path="*" element={<><BackButton fallback="/train" /><LabelProbe fallback="/train" /></>} /></Routes>
      </MemoryRouter>,
    )
    // useBackTo names the fallback (no history to pop)
    expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'vissza' }))
    expect(screen.getByTestId('path')).toHaveTextContent('/train')
  })
})

test('idx > 0 means there is in-app history: both hooks pop it', () => {
  withHistoryIdx(2, () => {
    render(
      <MemoryRouter initialEntries={['/train/gym', '/train/session']} initialIndex={1}>
        <Probe />
        <Routes><Route path="*" element={<><BackButton fallback="/train" /><LabelProbe fallback="/train" /></>} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'vissza' }))
    expect(screen.getByTestId('path')).toHaveTextContent('/train/gym')
  })
})

// ── useLeaveAfterMutation (mezo-n4wf5.1 final review, I1): after a save / delete the form or the
// deleted record must not stay BEHIND the user, where the history back would walk into it ──
function Leaver() {
  const leave = useLeaveAfterMutation()
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => leave.to('/list?saved')}>to</button>
      <button type="button" onClick={() => leave.back('/detail')}>back</button>
      <button type="button" onClick={() => leave.pastDetail('/list')}>pastDetail</button>
      <button type="button" onClick={() => navigate(-1)}>pop</button>
    </>
  )
}
function renderLeaver(entries: string[]) {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Probe />
      <Routes>
        <Route path="*" element={<Leaver />} />
      </Routes>
    </MemoryRouter>,
  )
}
const path = () => screen.getByTestId('path')

test('leave.to REPLACES the form: the next back skips it', () => {
  renderLeaver(['/home', '/form'])
  fireEvent.click(screen.getByRole('button', { name: 'to' }))
  expect(path()).toHaveTextContent(/^\/list$/)
  fireEvent.click(screen.getByRole('button', { name: 'pop' }))
  expect(path()).toHaveTextContent(/^\/home$/)
})

test('leave.back pops onto the page the editor was opened from — it is not doubled', () => {
  renderLeaver(['/list', '/detail', '/detail/edit'])
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(path()).toHaveTextContent(/^\/detail$/)
  fireEvent.click(screen.getByRole('button', { name: 'pop' }))
  expect(path()).toHaveTextContent(/^\/list$/)
})

test('leave.back on a direct open replaces the editor with its page', () => {
  renderLeaver(['/detail/edit'])
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(path()).toHaveTextContent(/^\/detail$/)
})

test('leave.pastDetail without a browser entry index replaces the editor with the list', () => {
  renderLeaver(['/home', '/detail/edit'])
  fireEvent.click(screen.getByRole('button', { name: 'pastDetail' }))
  expect(path()).toHaveTextContent(/^\/list$/)
  fireEvent.click(screen.getByRole('button', { name: 'pop' }))
  expect(path()).toHaveTextContent(/^\/home$/)
})
