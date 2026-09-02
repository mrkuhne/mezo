import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-05-14T09:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const MESO_ID = 'meso-hyp-04'

function setup(muscle = 'back') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${MESO_ID}/week/${muscle}`],
  })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

test('the hero names the muscle, current → ceiling', () => {
  setup('back')
  // back: current 16, ceiling (grow → MAV) 16 in the meso-hyp-04 fixture.
  expect(screen.getByText(/Hát/)).toBeInTheDocument()
  expect(document.querySelector('.mz-bignum')?.textContent).toContain('16')
})

test('the five section eyebrows all render', () => {
  setup('back')
  expect(screen.getByText('A sáv · hol tartasz')).toBeInTheDocument()
  expect(screen.getByText('A blokk íve · W1 → deload')).toBeInTheDocument()
  expect(screen.getByText('Ezen a héten · hol dolgozik')).toBeInTheDocument()
  expect(screen.getByText('Honnan a sáv · levezetés')).toBeInTheDocument()
  expect(screen.getByText('Előző blokk')).toBeInTheDocument()
})

test('the derivation has 4 numbered steps', () => {
  setup('back')
  const nums = document.querySelectorAll('.mz-dnum')
  expect(Array.from(nums).map((n) => n.textContent)).toEqual(['1', '2', '3', '4'])
  expect(screen.getByText('Baseline · RP tábla')).toBeInTheDocument()
  expect(screen.getByText('Fókusz-sáv · Grow')).toBeInTheDocument()
  expect(screen.getByText('Rád szabva')).toBeInTheDocument()
  expect(screen.getByText('Eredő · a blokkban')).toBeInTheDocument()
})

test('Rád szabva shows the real adjustments when the engine made them', () => {
  setup('back') // back's fixture carries 2 adjustments (pattern + sport-cross)
  expect(screen.getByText(/Pull Day konzisztencia/)).toBeInTheDocument()
  expect(screen.queryByText('nincs igazítás — a baseline érvényes')).not.toBeInTheDocument()
})

test('Rád szabva reads honestly empty for triceps (no adjustments in the fixture)', () => {
  setup('triceps')
  expect(screen.getByText('nincs igazítás — a baseline érvényes')).toBeInTheDocument()
})

test('a maintain-tier muscle (shoulder) skips the ramp band but keeps the rest of the page', () => {
  setup('shoulder')
  expect(screen.getByText('A blokk íve · W1 → deload')).toBeInTheDocument()
  expect(screen.queryByText('A sáv · hol tartasz')).not.toBeInTheDocument()
})

test('previous-block ghost when no archived run ever carried this muscle', () => {
  setup('back')
  // meso-hyp-04's own fixture archived runs carry no volumePerMuscle snapshot.
  expect(screen.getByText('nincs előző blokk')).toBeInTheDocument()
})

test('a muscle missing from the arc shows the ghost state, not a crash', () => {
  setup('core') // not one of meso-hyp-04's volumePerMuscle groups
  expect(screen.getByText('Ez az izom nincs a heti vizsgálatban.')).toBeInTheDocument()
})
