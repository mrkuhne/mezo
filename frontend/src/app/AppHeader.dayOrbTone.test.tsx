// ============================================================
// Mezo · AppHeader — a DayOrb tónus-tengelyének KOMPOZÍCIÓS fedezete (mezo-tzid).
//
// A tónus-lánc mind a négy rétegen assertelve van külön-külön: `dayOrbTone.test.ts` (a napi
// pont), `dayOrbFill.test.ts` (pont → intenzitás), `useDayOrbFill.test.tsx` (az értékelés-
// válasz → intenzitás vezetékezése) és `DayOrb.test.tsx` (intenzitás → konkrét stop-color
// hexek). EGY rés maradt: a KOMPOZÍCIÓ. Ha az `AppHeader` a `dayOrb.intensity` helyett
// konstanst adna át a `DayOrb`-nak, mind a négy fenti teszt zöld maradna — a hiba csak a
// renderelt fejlécben látszana. Ez a fájl azt a rést zárja: a mai nap értékeléséből a
// fejléc DOM-jában megjelenő gradiens-stopokig megy el.
//
// A vizuális goldenek szándékosan NEM eszközei ennek: a pixelmatch 0.2-es per-pixel küszöbe
// elnyeli a kifakult↔telt eltolódást (a mezo-x5va átkötés NULLA goldent mozdított), a
// stop-color hexek viszont egzaktak.
// Spec: bd mezo-tzid
// ============================================================
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AppHeader } from '@/app/AppHeader'
import type { DayEvaluationResponse } from '@/data/hooks'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

// Az értékelés-hookot mockoljuk (a `useDayOrbFill.test.tsx` mintája), hogy a tónus MINDKÉT
// CI-módban determinisztikus legyen — a többi `@/data/hooks` export valós marad. A fejléc
// többi olvasása a mock-seedből jön (`VITE_USE_MOCK=true` lent).
const hoisted = vi.hoisted(() => ({ evaluation: undefined as DayEvaluationResponse | undefined }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useDayEvaluation: () => ({
      data: hoisted.evaluation, isPending: false, error: null, refetch: () => {},
    }),
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => {
  hoisted.evaluation = undefined
  vi.unstubAllEnvs()
})

/** Két KÉSZ, intrinsic dimenzió — pont annyi, amennyi a `provisionalDayScore` kapuját
 *  kinyitja. A súlyok a backend renormalizálását utánozzák (összegük 1). */
function evaluationScoring(score: number): DayEvaluationResponse {
  return {
    date: '2026-08-30', state: 'in_progress', score: null, base: null, adjustment: null,
    narrative: [], highlights: [], context: [],
    dimensions: [
      { id: 'training', label: 'Edzés', weight: 0.5, score, status: 'DONE', facts: [], note: null },
      { id: 'sleep', label: 'Alvás', weight: 0.5, score, status: 'DONE', facts: [], note: null },
    ],
  }
}

/** A fejléc DayOrb-jának gradiens-stopjai, a render sorrendjében. A `.dayorb`-ra szűkítünk,
 *  hogy egy jövőbeli másik SVG a fejlécben ne szennyezze a leolvasást. */
function orbStops(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('.dayorb stop')].map((s) => s.getAttribute('stop-color'))
}

function renderHeader() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/']}>
        <TutorialProvider>
          <MezoThreadProvider>
            <AppHeader />
          </MezoThreadProvider>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// A három várt hármas a `DayOrb.tsx` PALE/FULL végpontjaiból jön (`DayOrb.test.tsx` rögzíti
// őket); a pont → intenzitás leképezést a `dayOrbFill.ts` INTENSITY_FLOOR=45 / CEIL=92
// szabja meg. 95 ≥ 92 → intensity 1; 20 ≤ 45 → intensity 0; értékelés nélkül a
// `provisionalDayScore` null-t ad → NEUTRAL_INTENSITY (0.5) → a két végpont felezőpontja.
const FULL = ['#ffc3a8', '#ff7a55', '#d8481f']
const PALE = ['#f3e2d9', '#e3bdab', '#c69c89']
const NEUTRAL = ['#f9d3c1', '#f19c80', '#cf7254']

test('erős napi értékelés a TELT tónust rajzolja a fejléc orbjára', () => {
  hoisted.evaluation = evaluationScoring(95)
  expect(orbStops(renderHeader().container)).toEqual(FULL)
})

test('gyenge napi értékelés a KIFAKULT tónust rajzolja a fejléc orbjára', () => {
  hoisted.evaluation = evaluationScoring(20)
  expect(orbStops(renderHeader().container)).toEqual(PALE)
})

test('értékelés nélkül a fejléc orbja a SEMLEGES tónuson marad', () => {
  hoisted.evaluation = undefined
  expect(orbStops(renderHeader().container)).toEqual(NEUTRAL)
})
