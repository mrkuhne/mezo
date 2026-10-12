// ============================================================
// Mezo · GlycemicGlass — a vércukor-válasz lapja (mezo-6mi43; Folyadék F5, mezo-n4wf5.5: világos lap, nem üvegdoboz)
//
// Amit ezek a körök őriznek (owner-döntések, mindkettő kétszer megerősítve):
//   · a dobozban SEMMILYEN glikémiás index nem jelenik meg — se a szó, se index-szám;
//   · a felület szava „vércukor-válasz";
//   · a „magas" sáv sem hibáztat;
//   · ha a cukor becsült, a doboz KIMONDJA — feltevést mért adatként bemutatni tilos;
//   · nem natív <dialog>: az a böngésző-ablakhoz méreteződik és kiszabadul a telefon-keretből — a közös `Sheet`
//     a telefon-keretbe portáloz.
// ============================================================
import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { GlycemicGlass } from '@/features/fuel/components/GlycemicGlass'
import { GlyMini } from '@/features/fuel/components/folyadek'
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
  test('a lap címe a sáv magyar szava, és a felület „vércukor-válasz"-t mond', () => {
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    const box = boxOf()
    expect(within(box).getByRole('heading', { level: 2 })).toHaveTextContent(/^Magas$/)
    expect(box).toHaveAccessibleName('Magas')
    expect(box.textContent).toContain('Vércukor-válasz · várható hatás')
    // a háromsávos csík az aktív sávot jelöli
    expect(within(box).getByRole('img', { name: 'Vércukor-válasz sávja: magas' }).querySelector('.on')).toHaveTextContent('Magas')
    expect(within(box).getByText('Ez most megdobja.')).toBeInTheDocument()
  })

  test('világos lap, nem üvegdoboz', () => {
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    expect(boxOf().className).toContain('fo-sheet')
    expect(boxOf().className).not.toMatch(/glass|fmx-/)
    expect(boxOf().querySelector('[class*="fmx-"]')).toBeNull()
  })

  test('a lap feje egyetlen számjegyet sem tartalmaz, és a görbe tengelyén csak idő áll', () => {
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    expect(boxOf().querySelector('.fo-shh')!.textContent).not.toMatch(/\d/)
    const texts = Array.from(boxOf().querySelectorAll('.fe-gcv text')).map(t => t.textContent)
    expect(texts).toEqual(['alapszint', 'csúcs', 'visszaesés', 'evés', '+1 ó', '+2 ó', '+3 ó'])
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
        // a range („3–4 órára") is written with an en dash since Folyadék F5: the number before the dash belongs to it
        .filter(m => !/^(g|gramm|óra|órára|ó|perc|%|[-–]\d|,\d|\d)/.test(m[2]))
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

  test('a görbe alakja a sávot követi, és a felolvasónak az ALAKOT mondja, számot nem', () => {
    const { unmount } = render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    const high = boxOf().querySelector('.fe-gcv')!
    expect(high.getAttribute('role')).toBe('img')
    expect(high.getAttribute('aria-label')).toBe('A várható vércukor-válasz alakja három órán át: csúcs')
    const highPath = high.querySelector('path.line')!.getAttribute('d')
    unmount()
    render(<GlycemicGlass band={LOW} onClose={() => {}} />)
    const low = boxOf().querySelector('.fe-gcv')!
    expect(low.getAttribute('aria-label')).toBe('A várható vércukor-válasz alakja három órán át: lapos domb')
    expect(low.querySelector('path.line')!.getAttribute('d')).not.toBe(highPath)
  })

  test('két görbe egy lapon sem osztozik színátmenet-azonosítón', () => {
    render(<><GlycemicGlass band={HIGH} onClose={() => {}} /><GlycemicGlass band={LOW} onClose={() => {}} /></>)
    const ids = Array.from(document.querySelectorAll('.fe-gcv linearGradient')).map(g => g.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    for (const svg of Array.from(document.querySelectorAll('.fe-gcv'))) {
      expect(svg.querySelector('path.fill')!.getAttribute('fill')).toBe(`url(#${svg.querySelector('linearGradient')!.id})`)
    }
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
  test('nem natív <dialog> — a `Sheet` portálja adja a lapot', () => {
    render(<GlycemicGlass band={MID} onClose={() => {}} />)
    expect(document.querySelector('dialog')).toBeNull()
    expect(boxOf().getAttribute('aria-modal')).toBe('true')
  })

  test('a „Bezárom" gomb zár', async () => {
    const onClose = vi.fn()
    render(<GlycemicGlass band={MID} onClose={onClose} />)
    within(boxOf()).getByRole('button', { name: 'Bezárom' }).click()
    // a lap a közös csúszó zárással megy le, utána szól a hívónak
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  // Folyadék: a mozgás a stíluslap `prefers-reduced-motion: no-preference` ágában él, nem JS-osztályban — a jelölés
  // mindkét beállításnál ugyanaz, és a kész alak az alap-képkocka.
  test('csökkentett mozgás mellett a görbe kész alakja áll (nincs JS-vezérelt rajzolás)', () => {
    stubReduced(true)
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    const curve = boxOf().querySelector('.fe-gcv')!
    expect(curve.classList.contains('is-draw')).toBe(false)
    expect(curve.querySelector('path.line')!.getAttribute('style')).toBeNull()
  })

  test('mozgás-preferencia nélkül is ugyanaz a jelölés: a rajzolást a stíluslap adja', () => {
    stubReduced(false)
    render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    const curve = boxOf().querySelector('.fe-gcv')!
    expect(curve.classList.contains('is-draw')).toBe(false)
    expect(curve.querySelector('path.line')).not.toBeNull()
  })

  test('„Legközelebb így lesz laposabb": két lépés és az őszinte eredménysor; alacsonyon nincs', () => {
    const { unmount } = render(<GlycemicGlass band={HIGH} onClose={() => {}} />)
    const section = within(boxOf()).getByRole('region', { name: 'Legközelebb így lesz laposabb' })
    const steps = Array.from(section.querySelectorAll('.fx-tip b')).map(b => b.textContent)
    expect(steps).toHaveLength(2)
    expect(steps[0]).toMatch(/^1\. /)
    expect(steps[1]).toMatch(/^2\. /)
    expect(section.querySelector('.fe-result')!.textContent).toMatch(/A kettővel együtt/)
    unmount()
    render(<GlycemicGlass band={LOW} onClose={() => {}} />)
    expect(within(boxOf()).queryByRole('region', { name: 'Legközelebb így lesz laposabb' })).toBeNull()
  })

  test('az AI-tippek (a tányér saját tételei) elsőbbséget kapnak a kiszámolt cserék előtt', () => {
    const tips = [
      { title: 'A mézből elég a fele', body: 'A méz a leggyorsabb rész.' },
      { title: 'Dió a banán mellé', body: 'A zsír lassít.' },
    ]
    render(<GlycemicGlass band={HIGH} onClose={() => {}} aiTips={tips} />)
    const section = within(boxOf()).getByRole('region', { name: 'Legközelebb így lesz laposabb' })
    expect(section.textContent).toContain('A mézből elég a fele')
    expect(section.textContent).toContain('1. A mézből elég a fele')
    expect(section.textContent).toContain('Javaslat a tányérod tételeiből.')
    expect(section.textContent).not.toMatch(/coach/i)
    // a számolt eredménysor csak a számolt cseréké — az AI-hoz nem ígérünk sávot
    expect(section.querySelector('.fe-result')).toBeNull()
  })

  test('üres AI-lista: a coach szerint nincs mit simítani — a rész elmarad', () => {
    render(<GlycemicGlass band={HIGH} onClose={() => {}} aiTips={[]} />)
    expect(within(boxOf()).queryByRole('region', { name: 'Legközelebb így lesz laposabb' })).toBeNull()
  })
})

// The icon-size curve is the shared `GlyMini` since Folyadék F5 (the `GlycemicMiniCurve` wrapper left with its last user).
describe('GlyMini · a késő esti szellem görbe (mezo-tegkf)', () => {
  test('alapértelmezésben (`late` nélkül) nincs szellem görbe', () => {
    const { container } = render(<GlyMini level="high" />)
    expect(container.querySelector('.fx-gmini')).not.toBeNull()
    expect(container.querySelector('.fx-gmini .late')).toBeNull()
  })

  test('`late` esetén megjelenik a szaggatott szellem görbe', () => {
    const { container } = render(<GlyMini level="high" late />)
    expect(container.querySelector('.fx-gmini .late')).not.toBeNull()
  })
})
