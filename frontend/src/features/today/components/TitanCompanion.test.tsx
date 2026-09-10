// ============================================================
// Mezo · TitanCompanion — a HATÁR őre (mezo-mhum, Task 7).
//
// Maga a `TitanScene` WebGL-t futtat, ami a jsdomban nincs — annak SZÁNDÉKOSAN nincs unit
// tesztje. Amit viszont őrizni KELL, az a kapu: mikor NEM szabad a three.js-t behúzni.
// A jelenet lusta chunkban él, tehát a „nem töltjük be" állítás nem esztétika, hanem a fő
// bundle mérete és a csökkentett mozgás tisztelete.
// ============================================================
import { render, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TitanCompanion } from './TitanCompanion'

/** Akkor fut le, amikor a `./TitanScene` modult TÉNYLEG importálja valaki (a vi.mock gyárát
 *  a vitest lustán, az első importkor hívja meg) — pontosan ezt akarjuk mérni. */
const sceneImported = vi.hoisted(() => vi.fn())
vi.mock('@/features/today/components/TitanScene', () => {
  sceneImported()
  return { TitanScene: () => <canvas data-testid="titan-canvas" /> }
})

const states = [
  { key: 'energia', band: 'green' }, { key: 'hidratacio', band: 'yellow' }, { key: 'pihenes', band: 'green' },
] as never

/** WebGL a jsdomban nincs; a társ élő ága csak akkor indul, ha van. Ez adja a POZITÍV
 *  kontrollt — enélkül a „nem töltődik be" állítás vakon zöldellne. */
const realGetContext = HTMLCanvasElement.prototype.getContext
function stubWebGL(available: boolean) {
  // Két fogás, mert a detektálás is kettő: a konstruktor MEGLÉTE (a jsdomban nincs) és a
  // tényleges kontextus-kérés.
  vi.stubGlobal('WebGL2RenderingContext', available ? class {} : undefined)
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string) {
    if (id === 'webgl2' || id === 'webgl') return available ? ({} as never) : null
    return realGetContext.call(this, id) as never
  } as typeof realGetContext
}
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }))
}

// FIGYELEM (mezo-mhum javítóhullám): itt NINCS `sceneImported.mockClear()`. A számláló
// KUMULATÍV, a fájl egész futására: a modult a vitest egyszer, az ELSŐ importkor tölti be, így
// egy lenullázott számláló mellett a „soha nem importáltuk" állítások némán vakká válnának
// (egy modul-szintű import után is zöldek maradnának). Így viszont bármelyik korábbi import
// hangosan megbuktatja a két negatív esetet.
afterEach(() => {
  vi.unstubAllGlobals()
  HTMLCanvasElement.prototype.getContext = realGetContext
})

describe('TitanCompanion', () => {
  test('tap opens the signals surface and the button is labelled', () => {
    const open = vi.fn()
    render(<TitanCompanion states={states} onOpenSignals={open} />)
    fireEvent.click(screen.getByRole('button', { name: /életjelek/i }))
    expect(open).toHaveBeenCalledOnce()
  })

  test('aura colors come from the need meta, per band', () => {
    render(<TitanCompanion states={states} onOpenSignals={() => {}} />)
    const aura = document.querySelector('.titan-aura') as HTMLElement
    expect(aura.style.getPropertyValue('--aura-0')).not.toBe('')
  })

  // FONTOS: ez a két eset SORRENDBEN fut. A `React.lazy` a modult egyszer tölti be és a
  // betöltött állapotot a komponens-azonosítón tartja, tehát a „nem importáltuk" állítást
  // csak az élő ág futtatása ELŐTT lehet őszintén kimondani. A számláló kumulatív (lásd az
  // afterEach-et), tehát a fájl BÁRMELY korábbi importja is megbuktatja ezt a két esetet.
  test('csökkentett mozgás mellett NINCS canvas, és a three.js chunk el sem indul', async () => {
    stubReducedMotion(true)
    stubWebGL(true)   // van WebGL — tehát tényleg CSAK a mozgás-preferencia tartja vissza
    const { container } = render(<TitanCompanion states={states} onOpenSignals={() => {}} />)
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('.titan-svg')).not.toBeNull()
    expect(sceneImported).not.toHaveBeenCalled()
  })

  test('WebGL nélkül szintén a statikus jel marad (jsdom, régi böngésző)', async () => {
    stubReducedMotion(false)
    stubWebGL(false)
    const { container } = render(<TitanCompanion states={states} onOpenSignals={() => {}} />)
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('canvas')).toBeNull()
    expect(sceneImported).not.toHaveBeenCalled()
  })

  test('pozitív kontroll: WebGL + normál mozgás mellett az ÉLŐ jelenet töltődik be', async () => {
    stubReducedMotion(false)
    stubWebGL(true)
    render(<TitanCompanion states={states} onOpenSignals={() => {}} />)
    expect(await screen.findByTestId('titan-canvas')).toBeInTheDocument()
    expect(sceneImported).toHaveBeenCalled()
  })
})
