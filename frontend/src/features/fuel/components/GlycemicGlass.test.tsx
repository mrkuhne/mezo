// ============================================================
// Mezo · GlycemicGlass — a vércukor-válasz üvegdoboza (mezo-6mi43)
//
// Amit ezek a körök őriznek (owner-döntések, mindkettő kétszer megerősítve):
//   · a dobozban SEMMILYEN glikémiás index nem jelenik meg — se a szó, se index-szám;
//   · a felület szava „vércukor-válasz";
//   · a „magas" sáv sem hibáztat;
//   · ha a cukor becsült, a doboz KIMONDJA — feltevést mért adatként bemutatni tilos;
//   · nem natív <dialog>: az a böngésző-ablakhoz méreteződik és kiszabadul a telefon-keretből
//     (a `GlassBox` fejléce írja le, miért — 641 px-es doboz egy 416 px-es telefon fölött).
// ============================================================
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { GlycemicGlass } from '@/features/fuel/components/GlycemicGlass'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'

function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const HIGH = glycemicBand({ c: 100, sugarG: 60, fiberG: 0, p: 0, f: 0 })!
const MID = glycemicBand({ c: 50, sugarG: 0, fiberG: 2, p: 10, f: 12 })!
const LOW = glycemicBand({ c: 20, sugarG: 2, fiberG: 8, p: 30, f: 20 })!
const ESTIMATED = glycemicBand({ c: 64, sugarG: null, fiberG: 7, p: 22, f: 9 })!

const boxOf = () => screen.getByRole('dialog')

describe('GlycemicGlass · a sáv szava, szám helyett', () => {
  test('a hero a sáv magyar szavát mutatja, és a felület „vércukor-válasz"-t mond', () => {
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    const box = boxOf()
    expect(within(box).getByText('magas')).toBeInTheDocument()
    expect(box.textContent).toContain('Vércukor-válasz')
  })

  test('a sáv-hero egyetlen számjegyet sem tartalmaz', () => {
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    expect(boxOf().querySelector('.fmx-glu-hero')!.textContent).not.toMatch(/\d/)
  })

  test('se a „glikémiás index" szó, se index-szám nem jelenik meg — semelyik sávon', () => {
    for (const band of [LOW, MID, HIGH, ESTIMATED]) {
      const { unmount } = render(<GlycemicGlass band={band} onClose={() => {}} />)
      const copy = boxOf().textContent!.toLowerCase()
      expect(copy).not.toContain('glikémiás')
      expect(copy).not.toContain('glikemias')
      expect(copy).not.toContain('index')
      expect(copy).not.toContain('glycemic')
      // Ami szám van a dobozban, az mind mértékkel/idővel jár (gramm, óra, perc, százalék);
      // csupasz, mértékegység nélküli szám — egy index — nincs benne.
      const bare = [...copy.matchAll(/(\d+(?:[.,]\d+)?)(?![\d.,])\s*([^\s]{0,12})/g)]
        .filter(m => !/^(g|gramm|óra|órára|ó|perc|%|-\d|,\d|\d)/.test(m[2]))
      expect(bare, `csupasz szám a dobozban: ${JSON.stringify(bare.map(m => m[0]))}`).toEqual([])
      unmount()
    }
  })
})

describe('GlycemicGlass · őszinte becslés', () => {
  test('becsült cukor esetén a doboz kimondja, hogy ez becslés, nem mért adat', () => {
    render(<GlycemicGlass band={ESTIMATED} onClose={() => {}} />)
    const copy = boxOf().textContent!
    expect(copy).toContain('becsl')
    expect(copy).toContain('nem tudjuk')
  })

  test('ismert cukor esetén nincs becslés-figyelmeztetés', () => {
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    expect(boxOf().textContent).not.toContain('nem tudjuk')
  })
})

describe('GlycemicGlass · a tányér tényei és a kilátás', () => {
  test('mind a négy tény-sor és mind a három kilátás-sor ott van', () => {
    render(<GlycemicGlass band={ESTIMATED} onClose={() => {}} />)
    const box = boxOf()
    for (const fact of ESTIMATED.facts) {
      expect(within(box).getByText(fact.label)).toBeInTheDocument()
    }
    expect(within(box).getByText('Energia')).toBeInTheDocument()
    expect(within(box).getByText('Alapszint')).toBeInTheDocument()
    expect(within(box).getByText('Éhség')).toBeInTheDocument()
    expect(box.textContent).toContain(ESTIMATED.expect.energy)
    expect(box.textContent).toContain(ESTIMATED.tip.title)
  })

  test('a görbe alakja a sávot követi, és a felolvasó elől el van rejtve', () => {
    const { unmount } = render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    const high = boxOf().querySelector('.fmx-glu-curve')!
    expect(high.getAttribute('aria-hidden')).toBe('true')
    const highPath = high.querySelector('path')!.getAttribute('d')
    unmount()
    render(<GlycemicGlass band={LOW} onClose={() => {}} />)
    const lowPath = boxOf().querySelector('.fmx-glu-curve path')!.getAttribute('d')
    expect(lowPath).not.toBe(highPath)
  })
})

describe('GlycemicGlass · adherencia-semleges hang', () => {
  test('egyetlen sáv szövege sem hibáztat', () => {
    for (const band of [LOW, MID, HIGH, ESTIMATED]) {
      const { unmount } = render(<GlycemicGlass band={band} onClose={() => {}} />)
      const copy = boxOf().textContent!.toLowerCase()
      for (const word of ['elrontott', 'hiba', 'rossz', 'túllépt', 'kudarc', 'szégyen', 'bűn', 'tilos']) {
        expect(copy, `„${word}" nem szerepelhet`).not.toContain(word)
      }
      unmount()
    }
  })
})

describe('GlycemicGlass · a keretben él, és csökkentett mozgás mellett áll', () => {
  test('nem natív <dialog> — a `GlassBox` portálja adja a dobozt', () => {
    render(<GlycemicGlass band={MID} onClose={() => {}} />)
    expect(document.querySelector('dialog')).toBeNull()
    expect(boxOf().getAttribute('aria-modal')).toBe('true')
  })

  test('a „Bezárom" gomb zár', async () => {
    const onClose = vi.fn()
    render(<GlycemicGlass band={MID} onClose={onClose} />)
    within(boxOf()).getByRole('button', { name: 'Bezárom' }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('csökkentett mozgás mellett a görbe-rajzolás nem indul el', () => {
    stubReduced(true)
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    expect(boxOf().querySelector('.fmx-glu-curve')!.classList.contains('is-draw')).toBe(false)
  })

  test('mozgás-preferencia nélkül a görbe megrajzolja magát', () => {
    stubReduced(false)
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    expect(boxOf().querySelector('.fmx-glu-curve')!.classList.contains('is-draw')).toBe(true)
  })
})
