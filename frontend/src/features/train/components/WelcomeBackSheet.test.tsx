import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { RecoveryReturn } from '@/data/train/recoveryApi'
import { WelcomeBackSheet } from '@/features/train/components/WelcomeBackSheet'

const RESUME: RecoveryReturn = { rule: 'RESUME', daysOut: 3, rampSessions: 2, shiftDays: 7, newEndDate: '2026-10-25' }
const CONTINUE: RecoveryReturn = { rule: 'CONTINUE', daysOut: 2, rampSessions: 1, shiftDays: 0, newEndDate: null }

function renderSheet(ret: RecoveryReturn, over: { week?: number; showRun?: boolean } = {}) {
  const h = { onClose: vi.fn(), onOk: vi.fn(), onUndo: vi.fn() }
  const r = render(<WelcomeBackSheet ret={ret} {...over} {...h} />)
  return { ...h, ...r }
}

test('head: KÍMÉLŐ MÓD VÉGE · Üdv újra! · the sub line, t-sprout', () => {
  renderSheet(CONTINUE)
  expect(screen.getByText('KÍMÉLŐ MÓD VÉGE')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Üdv újra!' })).toBeInTheDocument()
  expect(screen.getByText('Így folytatjuk — a terv magától igazodik.')).toBeInTheDocument()
})

test('RESUME with the week: the calendar line, the 2-session ramp, the run line (prototype UDVX[1])', () => {
  renderSheet(RESUME, { week: 3 })
  const container = document.body // the sheet portals out of the render container
  const lines = [...container.querySelectorAll('.trm-udvl .trm-whynote')].map((n) => n.textContent)
  expect(lines).toEqual([
    '3 nap kiesés · onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz (okt. 18. → okt. 25.).',
    'Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.',
    'Az első futás kb. fele olyan hosszú, laza tempóban.',
  ])
  expect([...container.querySelectorAll('.trm-udvl use')].map((u) => u.getAttribute('href'))).toEqual(['#t-calendar', '#t-dumbbell', '#t-run'])
})

test('CONTINUE: the calendar keeps going, one lightened session; no run line without a running plan', () => {
  renderSheet(CONTINUE, { showRun: false })
  const container = document.body // the sheet portals out of the render container
  const lines = [...container.querySelectorAll('.trm-udvl .trm-whynote')].map((n) => n.textContent)
  expect(lines).toEqual([
    '2 nap kiesés · a program megy tovább a naptár szerint.',
    'Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.',
  ])
})

test('no rule tabs (prototype-only demo)', () => {
  renderSheet(RESUME)
  expect(screen.queryByText(/PRÓBÁLD KI/)).toBeNull()
  expect(screen.queryByRole('button', { name: '1–2 nap' })).toBeNull()
})

test('Rendben: onOk then closes; Mégsem vagyok jól: onUndo (the caller closes on success)', async () => {
  const { onOk, onUndo, onClose } = renderSheet(CONTINUE)
  fireEvent.click(screen.getByRole('button', { name: 'Mégsem vagyok jól' }))
  expect(onUndo).toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Rendben' }))
  expect(onOk).toHaveBeenCalled()
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
