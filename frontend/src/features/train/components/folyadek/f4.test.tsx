import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Cell, Cells, DeltaChip, InfoLine, KcalBowl, MuscleStarRow, ProgressVessels, QuestCapsule, QuestLine, QuestTick, QuestType, QuestWhy,
  RecordToast, ReturnFab, SessionDock, SetGrid, SidePicker, ToolBtn, ToolRow, VerdictLegend, kcalBowlShares, type SetGridRow,
} from './index'

describe('Edzés · F4 · quest pieces', () => {
  it('QuestCapsule fills to the confidence when taken; a quest still being learned has no level at all', () => {
    const { container, rerender } = render(<QuestCapsule on confidence={0.72} />)
    const c = () => container.querySelector('.ex-qc')!
    expect(c()).toHaveClass('on')
    expect(c()).not.toHaveClass('nl')
    expect(c()).toHaveStyle({ '--p': '72%' })
    rerender(<QuestCapsule on confidence={null} />)
    expect(c()).toHaveClass('on', 'nl')
    expect(c()).toHaveStyle({ '--p': '0%' })
    rerender(<QuestCapsule on={false} full />)
    expect(c()).not.toHaveClass('nl')
    expect(c()).toHaveStyle({ '--p': '100%' })
  })

  it('QuestTick is a pressed button with the given name', () => {
    const on = vi.fn()
    render(<QuestTick on confidence={0.8} label="Evezés · Rekord-kísérlet: vállalva" onClick={on} />)
    const b = screen.getByRole('button', { name: 'Evezés · Rekord-kísérlet: vállalva' })
    expect(b).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(b)
    expect(on).toHaveBeenCalled()
  })

  it('QuestLine reads „kind · target", struck through and „elengedve" when released; QuestType and QuestWhy', () => {
    const { container, rerender } = render(<QuestLine label="Túlterhelés" target="12,5 kg × 8" aria-label="Túlterhelés küldetés · vállalva" />)
    expect(screen.getByRole('button', { name: 'Túlterhelés küldetés · vállalva' })).toHaveTextContent('Túlterhelés · 12,5 kg × 8')
    rerender(<QuestLine label="Túlterhelés" target="12,5 kg × 8" released aria-label="Túlterhelés küldetés · elengedve" />)
    expect(container.querySelector('.ex-ql')).toHaveClass('rel')
    expect(container.querySelector('.ex-ql s')).toHaveTextContent('12,5 kg × 8')
    rerender(<><QuestType icon="t-record">Rekord-kísérlet</QuestType><QuestWhy why="Május óta 70 a stabil ablak." glory="Új súly-rekord lenne." /></>)
    expect(container.querySelector('.ex-qt > .fo-bub')).not.toBeNull()
    expect(container.querySelector('.ex-why > p')).toHaveTextContent('Május óta 70 a stabil ablak.')
    expect(container.querySelector('.ex-why > b')).toHaveTextContent('Új súly-rekord lenne.')
  })
})

describe('Edzés · F4 · session pieces', () => {
  it('ProgressVessels: one named button per exercise, as wide as its sets, filled to its done share; the one on top is current', () => {
    const on = vi.fn()
    const { container } = render(
      <ProgressVessels activeId="b" onPick={on} items={[
        { id: 'a', label: 'Húzódzkodás · 4 / 4 szett', done: 4, planned: 4, color: 'red' },
        { id: 'b', label: 'Evezés · 1 / 3 szett', done: 1, planned: 3, color: 'blue' },
        { id: 'c', label: 'Rear Delt Fly · 0 / 3 szett', done: 0, planned: 3, color: 'green', off: true },
      ]} />,
    )
    const b = [...container.querySelectorAll('.ex-pv > button')] as HTMLElement[]
    expect(b[0]).toHaveClass('full')
    expect(b[0].style.flex).toMatch(/^4/)
    expect(b[1]).toHaveClass('on')
    expect(b[1]).toHaveAttribute('aria-current', 'true')
    expect(b[1].querySelector('span > i')).toHaveStyle({ '--pw': `${(1 / 3) * 100}%` })
    expect(b[1].querySelector('small')).toHaveTextContent('2. · 1/3')
    expect(b[2]).toHaveClass('off')
    fireEvent.click(screen.getByRole('button', { name: 'Rear Delt Fly · 0 / 3 szett' }))
    expect(on).toHaveBeenCalledWith('c')
  })

  it('tools, cells, lines, the delta chip and the legend', () => {
    const note = vi.fn()
    const { container } = render(
      <>
        <ToolRow><ToolBtn icon="t-journal" aria-label="Evezés · előzmények és rekordok">Rekordok</ToolBtn></ToolRow>
        <Cells><Cell label="Múlt hét" value="70 × 10 · RIR 2" /><Cell label="Mai cél" value="72,5 × 10" target><DeltaChip tone="up">+2,5 kg</DeltaChip></Cell></Cells>
        <InfoLine icon="t-note" onClick={note} aria-label="Gyakorlat-jegyzet">Könyök a test mellett</InfoLine>
        <InfoLine icon="t-swap">Csak ma · a Húzódzkodás helyett</InfoLine>
        <DeltaChip tone="hold">tartás</DeltaChip>
        <VerdictLegend />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Evezés · előzmények és rekordok' })).toHaveClass('ex-tool')
    const cells = container.querySelectorAll('.ex-tg > span')
    expect(cells).toHaveLength(2)
    expect(cells[1]).toHaveClass('t')
    expect(cells[1].querySelector('.ex-dchip.up')).toHaveTextContent('+2,5 kg')
    fireEvent.click(screen.getByRole('button', { name: 'Gyakorlat-jegyzet' }))
    expect(note).toHaveBeenCalled()
    expect(container.querySelector('p.ex-xl')).toHaveTextContent('Csak ma · a Húzódzkodás helyett')
    expect(container.querySelector('.ex-dchip:not(.up):not(.down)')).toHaveTextContent('tartás')
    expect([...container.querySelectorAll('.ex-leg > span')].map((s) => s.textContent)).toEqual(['célsávban', 'rekord', 'cél fölött', 'cél alatt'])
  })

  it('SidePicker: Bal / Mindkettő / Jobb map to L / B / R; the pressed one clears', () => {
    const on = vi.fn()
    const { rerender } = render(<SidePicker value={null} onChange={on} />)
    expect(screen.getByRole('group', { name: 'Oldal' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Jobb' }))
    expect(on).toHaveBeenLastCalledWith('R')
    rerender(<SidePicker value="B" onChange={on} />)
    expect(screen.getByRole('button', { name: 'Mindkettő' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Mindkettő' }))
    expect(on).toHaveBeenLastCalledWith(null)
  })

  const rows = (over: Partial<Extract<SetGridRow, { kind: 'cursor' }>> = {}): { rows: SetGridRow[]; h: Record<string, ReturnType<typeof vi.fn>> } => {
    const h = { edit: vi.fn(), kg: vi.fn(), reps: vi.fn(), rir: vi.fn(), submit: vi.fn(), blur: vi.fn() }
    return { h, rows: [
      { kind: 'done', kg: '12,5', reps: 8, rir: 2, verdict: 'record', onEdit: h.edit },
      { kind: 'done', kg: '12,5', reps: 7, rir: 1, verdict: 'down', busy: true, onEdit: h.edit },
      { kind: 'cursor', kg: '12,5', reps: '8', rir: '2', onKg: h.kg, onKgBlur: h.blur, onReps: h.reps, onRir: h.rir, onSubmit: h.submit, ...over },
      { kind: 'pending', kg: '12,5', reps: '8–10', rir: 2 },
    ] }
  }

  it('SetGrid: done rows open the edit sheet from their verdict mark, the cursor row is the only one with fields, later rows are quiet', () => {
    const { rows: r, h } = rows()
    const { container } = render(<SetGrid name="Húzódzkodás" color="teal" rirMax={5} rows={r} />)
    expect(screen.getByRole('group', { name: 'Húzódzkodás · szettek' })).toHaveStyle({ '--c': 'teal' })
    fireEvent.click(screen.getByRole('button', { name: '1. szett szerkesztése · rekord' }))
    expect(h.edit).toHaveBeenCalledTimes(1)
    const busy = screen.getByRole('button', { name: '2. szett szerkesztése · mentés folyamatban' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('input')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Húzódzkodás, 3. szett, súly'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Húzódzkodás, 3. szett, ismétlés'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Húzódzkodás, 3. szett, RIR (0–5)'), { target: { value: '1' } })
    expect([h.kg.mock.calls[0][0], h.reps.mock.calls[0][0], h.rir.mock.calls[0][0]]).toEqual(['15', '9', '1'])
    fireEvent.blur(screen.getByLabelText('Húzódzkodás, 3. szett, súly'))
    expect(h.blur).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '3. szett mentése' }))
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('group', { name: '4. szett · terv' })).toHaveTextContent('12,58–102')
    expect([...container.querySelectorAll('.ex-sets .n')].map((n) => n.className)).toEqual(['n f', 'n f', 'n h', 'n'])
  })

  it('SetGrid: a weightless exercise has no weight to type; a blocked session cannot save; side and caption hang under the grid', () => {
    const side = vi.fn()
    const { rows: r, h } = rows({ weightless: true, disabled: true })
    const { container, rerender } = render(<SetGrid name="Dobozra ugrás" color="teal" rows={r} side={{ value: null, onChange: side }} adjust="70 kg-hoz igazítva · ajánlás 72,5 × 10" />)
    expect(screen.getByLabelText('Dobozra ugrás, 3. szett, súly')).toBeDisabled()
    expect(screen.getByRole('button', { name: '3. szett mentése' })).toBeDisabled()
    fireEvent.submit(container.querySelector('form')!)
    expect(h.submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Bal' }))
    expect(side).toHaveBeenCalledWith('L')
    expect(container.querySelector('.ex-adj')).toHaveTextContent('70 kg-hoz igazítva · ajánlás 72,5 × 10')
    // a finished exercise has no cursor: neither the side picker nor the caption stays
    rerender(<SetGrid name="Dobozra ugrás" color="teal" rows={r.filter((x) => x.kind !== 'cursor')} side={{ value: null, onChange: side }} adjust="x" />)
    expect(container.querySelector('.ex-side')).toBeNull()
    expect(container.querySelector('.ex-adj')).toBeNull()
  })

  it('RecordToast is a status; ReturnFab carries the done sets and its name', () => {
    const on = vi.fn()
    const { container, rerender } = render(<><RecordToast eyebrow="Új rekord · súly" value="12,5 kg" note="Eddigi legjobbad 10 kg volt." /><ReturnFab doneSets={3} onClick={on} /></>)
    expect(screen.getByRole('status')).toHaveTextContent('Új rekord · súly12,5 kgEddigi legjobbad 10 kg volt.')
    expect(container.querySelector('.ex-mtw > .ex-mtoast')).not.toBeNull()
    const fab = screen.getByRole('button', { name: 'Vissza az edzéshez' })
    expect(fab.querySelector('b')).toHaveTextContent('3')
    fireEvent.click(fab)
    expect(on).toHaveBeenCalled()
    rerender(<ReturnFab doneSets={0} />)
    expect(screen.getByRole('button', { name: 'Vissza az edzéshez' }).querySelector('b')).toBeNull()
  })
})

describe('Edzés · F4 · the dock', () => {
  afterEach(() => { document.querySelectorAll('.phone-screen').forEach((e) => e.remove()) })
  const props = (over: Partial<Parameters<typeof SessionDock>[0]> = {}) => ({
    resting: false, remaining: 0, total: 0, exerciseName: null, doneSets: 3, plannedSets: 10,
    onExtend: vi.fn(), onSkipRest: vi.fn(), onFinish: vi.fn(), finishDisabled: false, ...over,
  })
  const dock = () => document.querySelector('.ex-dock') as HTMLElement

  it('idle: the done work as a level and „Lezárás"; disabled when the page says so', () => {
    const p = props()
    const { rerender } = render(<SessionDock {...p} />)
    expect(dock()).toHaveAttribute('role', 'status')
    expect(dock()).toHaveTextContent('Elvégzett munka3 / 10 szett')
    expect(dock().querySelector('.fo-wlv > i')).toHaveStyle({ width: '30%' })
    fireEvent.click(screen.getByRole('button', { name: 'Lezárás' }))
    expect(p.onFinish).toHaveBeenCalled()
    rerender(<SessionDock {...props({ doneSets: 0, finishDisabled: true })} />)
    expect(screen.getByRole('button', { name: 'Lezárás' })).toBeDisabled()
  })

  it('resting: the vessel stands at what is LEFT (it drains), m:ss, whose rest it is, +30 mp and Tovább', () => {
    const p = props({ resting: true, remaining: 90, total: 150, exerciseName: 'Húzódzkodás' })
    render(<SessionDock {...p} />)
    expect(dock()).toHaveClass('is-resting')
    expect(dock().querySelector('.ex-rv > i')).toHaveStyle({ height: '60%' })
    expect(dock()).toHaveTextContent('1:30')
    expect(dock()).toHaveTextContent('pihenő · Húzódzkodás')
    fireEvent.click(screen.getByRole('button', { name: '+30 mp' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tovább' }))
    expect(p.onExtend).toHaveBeenCalled()
    expect(p.onSkipRest).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Lezárás' })).toBeNull()
  })

  it('the label of either face is the polite live region — never the ticking m:ss or the count', () => {
    const { rerender } = render(<SessionDock {...props()} />)
    expect(dock().querySelector('[aria-live]')).toHaveTextContent('Elvégzett munka')
    expect(dock().querySelector('strong')!.closest('[aria-live]')).toBeNull()
    rerender(<SessionDock {...props({ resting: true, remaining: 90, total: 150, exerciseName: 'Húzódzkodás' })} />)
    const live = dock().querySelectorAll('[aria-live="polite"]')
    expect(live).toHaveLength(1)
    expect(live[0]).toHaveTextContent('pihenő · Húzódzkodás')
  })

  it('CSS: at ≤360px the RESTING dock drops its label (the timer and two buttons must fit); the toast sits in the toast tier, above a sheet', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../styles/folyadek-edzes-kozos.css'), 'utf8')
    const narrow = css.slice(css.indexOf('@media (max-width: 360px)'))
    expect(narrow).toMatch(/\.ex-dock\.is-resting \.ex-rest small \{ display: none; \}/)
    const z = Number(/\.ex-mtw \{[^}]*z-index: (\d+)/.exec(css)?.[1])
    expect(z).toBeGreaterThan(211)   // .sheet 200 / .sheet-nested 211 (styles/prototype.css)
  })

  it('portals into .phone-screen when there is one', () => {
    document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"></div>')
    render(<SessionDock {...props()} />)
    expect(dock().closest('.phone-screen')).toBeTruthy()
  })
})

describe('Edzés · F4 · closing pieces', () => {
  it('kcalBowlShares: the frame and the workout share one 92% bowl; no frame, no bowl', () => {
    const s = kcalBowlShares(3100, 460)!
    expect(s.base + s.add).toBeCloseTo(92, 6)
    expect(s.add).toBeCloseTo((460 / 3560) * 92, 6)
    expect(kcalBowlShares(null, 460)).toBeNull()
    expect(kcalBowlShares(0, 460)).toBeNull()
    expect(kcalBowlShares(3100, 0)).toBeNull()
  })

  it('KcalBowl draws two liquids clipped to the bowl, with an id of its own per instance', () => {
    const { container } = render(<><KcalBowl base={80} add={12} /><KcalBowl base={70} add={22} /></>)
    const bowls = container.querySelectorAll('svg.ex-bowl')
    expect(bowls).toHaveLength(2)
    expect(bowls[0]).toHaveAttribute('aria-hidden', 'true')
    expect(bowls[0].querySelector('.a')).not.toBeNull()
    expect(bowls[0].querySelector('.b')).not.toBeNull()
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    expect(bowls[0].querySelector('g[clip-path]')!.getAttribute('clip-path')).toBe(`url(#${ids[0]})`)
  })

  it('MuscleStarRow: name, the stars of its ratio, done / plan', () => {
    const { container } = render(<MuscleStarRow muscle="back-wide" label="Hát (széles)" ratio={0.9} done={4} plan={4} />)
    expect(container.querySelector('.ex-mus.ex-mstar .l')).toHaveTextContent('Hát (széles)')
    expect(screen.getByRole('img', { name: '4,5 csillag az ötből' })).toBeInTheDocument()
    expect(container.querySelector('.ex-mstar .v')).toHaveTextContent('4 / 4 szett')
  })
})
