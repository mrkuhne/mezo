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

// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `udvSheet()`): a light sheet — three ramp tubes, three rows.
const rows = () => [...document.body.querySelectorAll('.em-udvl .fo-row')]
  .map((n) => `${n.querySelector('strong')?.textContent} · ${n.querySelector('small')?.textContent}`)
const tubes = () => [...document.body.querySelectorAll('.em-ramp .fo-vial')]
  .map((n) => `${n.querySelector(':scope > b')?.textContent} | ${n.querySelector('small')?.textContent}`)

test('head: Kímélő mód vége · Üdv újra! · the sub line, on the light sheet', () => {
  renderSheet(CONTINUE)
  expect(screen.getByText('Kímélő mód vége')).toBeInTheDocument()
  expect(document.body.querySelector('.sheet.fo-sheet.em-udv')).toBeInTheDocument()
  expect(document.body.querySelector('.sheet.glass, [class*="uvl-"], [class*="trm-"]')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Üdv újra!' })).toBeInTheDocument()
  expect(screen.getByText('Így folytatjuk — a terv magától igazodik.')).toBeInTheDocument()
})

test('RESUME with the week: the calendar line, the 2-session ramp, the run line (prototype UDVX[1])', () => {
  renderSheet(RESUME, { week: 3 })
  const container = document.body // the sheet portals out of the render container
  expect(rows()).toEqual([
    '3 nap kiesés · onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz (okt. 18. → okt. 25.).',
    'Könnyített kezdés · Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.',
    'Rövidebb első futás · Az első futás kb. fele olyan hosszú, laza tempóban.',
  ])
  expect([...container.querySelectorAll('.em-udvl use')].map((u) => u.getAttribute('href'))).toEqual(['#t-calendar', '#t-dumbbell', '#t-run'])
  // the server ramps two sessions: both lightened, the second with the old weight
  expect(tubes()).toEqual(['⅔ | 1. edzéskb. −10% súly', '⅔ | 2. edzésa régi súly', 'teljes | utánaa terv szerint'])
})

test('CONTINUE: the calendar keeps going, one lightened session; no run line without a running plan', () => {
  renderSheet(CONTINUE, { showRun: false })
  expect(rows()).toEqual([
    '2 nap kiesés · a program megy tovább a naptár szerint.',
    'Könnyített kezdés · Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.',
  ])
  // one ramp session: the second is already the full plan
  expect(tubes()).toEqual(['⅔ | 1. edzéskb. −10% súly', 'teljes | 2. edzésa terv szerint', 'teljes | utánaa terv szerint'])
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
