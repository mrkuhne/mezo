import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { Level, St } from '@/shared/ui/folyadek'
import {
  BowlGauge, DayBowl, Dial, EditLine, Glass, GlyBand, GlyChip, GlyMini, ItemRow, Kv, Lgd, LineTags, M3, MacroVials, MealCells, NumG, Nutri,
  MacroTriple, PlainCup, Pot, PourBowl, PourKey, ScoreChip, SlotCup, SplitBar, Strip, Tip, Tot, energyShares,
} from './index'

const CSS = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../styles/folyadek-fuel-kozos.css'), 'utf8')

afterEach(() => setLang('hu', { persist: false }))

describe('Fuel · Folyadék shared pieces (mezo-n4wf5.5)', () => {
  it('BowlGauge: eaten · the bowl to the budget · what still fits, named for a screen reader', () => {
    const onClick = vi.fn()
    const { container } = render(<BowlGauge eaten={2060} target={3100} rem={1040} remLabel="kcal fér még bele" onClick={onClick} />)
    const bowl = screen.getByRole('button', { name: '2 060 / 3 100 kcal' })
    expect(container.querySelector('.fx-bg > .fx-bg-n > b')).toHaveTextContent('2 060')
    expect(container.querySelector('.fx-bg > .fx-bg-n > small')).toHaveTextContent('kcal-t ettél')
    expect(container.querySelector('.fx-bg > .fx-bg-n.r')).toHaveTextContent('1 040kcal fér még bele')
    expect(bowl).toHaveTextContent('keret 3 100 kcal')
    expect(bowl.querySelector('.fx-bowl-liq')).not.toBeNull()
    expect(bowl.querySelector('.fx-bowl-skip')).toBeNull()
    fireEvent.click(bowl)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('BowlGauge: a skipped window is a dashed band and is said; an overshoot prints the absolute number; plain = the empty bowl', () => {
    const { container, rerender } = render(<BowlGauge eaten={2060} target={3100} rem={650} skipped={390} />)
    expect(screen.getByRole('img', { name: '2 060 / 3 100 kcal, ebből 390 kcal kihagyva' })).toBeInTheDocument()
    expect(container.querySelector('.fx-bowl-skip')).not.toBeNull()
    rerender(<BowlGauge eaten={3400} target={3100} rem={-300} over />)
    expect(container.querySelector('.fx-bg-n.r > b')).toHaveTextContent('300')
    rerender(<BowlGauge plain />)
    expect(screen.getByRole('img', { name: 'Üres tál' })).toBeInTheDocument()
    expect(container.querySelector('.fx-bg')).toHaveClass('plain')
    expect(container.querySelector('.fx-bg-n')).toBeNull()
    expect(container.querySelector('.fx-bowl-liq')).toBeNull()
  })

  it('every bowl instance has its own clip and gradient ids (bible trap 2)', () => {
    const { container } = render(<><DayBowl eatPct={40} /><DayBowl eatPct={60} /><PourBowl before={30} add={20} /><PourBowl before={30} add={20} ghost /></>)
    const ids = [...container.querySelectorAll('clipPath, linearGradient')].map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(container.querySelectorAll('.fx-pour .add')).toHaveLength(1)
    expect(container.querySelectorAll('.fx-pour .ghost')).toHaveLength(1)
  })

  it('PourKey, Pot, Glass, Dial render their marks', () => {
    const { container } = render(
      <>
        <PourKey before="ami már benne volt" add="ez az étkezés" />
        <Pot pct={0} /><Pot pct={60} />
        <Glass pct={52} nextPct={64} label="Ma eddig 1,3 / 2,5 liter" />
        <Dial from="12:00" to="14:30" at="12:40" /><Dial from="12:00" to="14:30" at="16:10" /><Dial />
      </>,
    )
    expect(container.querySelector('.fx-pk')).toHaveTextContent('ami már benne voltez az étkezés')
    expect(container.querySelectorAll('.fx-pot')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Ma eddig 1,3 / 2,5 liter' }).querySelector('.next')).not.toBeNull()
    const dials = container.querySelectorAll('.fx-dial')
    expect(dials[0].querySelector('.win')).not.toBeNull()
    expect(dials[0].querySelector('.at')).not.toHaveClass('out')
    expect(dials[1].querySelector('.at')).toHaveClass('out')
    expect(dials[2].querySelector('.win')).toBeNull()
    expect(dials[2].querySelector('.at')).toBeNull()
  })

  it('SlotCup: logged against the window\'s own budget, amber over it, never „over" on a gentle day; PlainCup is a number', () => {
    const { container, rerender } = render(<SlotCup kcal={689} budget={775} />)
    expect(screen.getByRole('img', { name: 'Logolva: 689 / 775 kcal (89%)' })).toHaveTextContent('689/ 775')
    rerender(<SlotCup kcal={0} budget={1005} />)
    expect(screen.getByRole('img', { name: 'Keret: 1 005 kcal' })).toHaveTextContent('1 005keret')
    rerender(<SlotCup kcal={900} budget={775} />)
    expect(container.querySelector('.fx-cup')).toHaveClass('over')
    rerender(<SlotCup kcal={900} budget={775} neutral />)
    expect(container.querySelector('.fx-cup')).not.toHaveClass('over')
    expect(screen.getByRole('img', { name: 'Logolva: 900 / 775 kcal' })).toBeInTheDocument()
    rerender(<><PlainCup kcal={356} /><PlainCup kcal={null} /></>)
    expect(container.querySelectorAll('.fx-cup')[0]).toHaveTextContent('356kcal')
    expect(container.querySelectorAll('.fx-cup')[1]).toHaveTextContent('—kcal')
  })

  it('energyShares: 4 / 4 / 9 kcal per gram, zero stays zero', () => {
    expect(energyShares(54, 79, 15)).toEqual({ p: 32, c: 47, f: 20 })
    expect(energyShares(0, 0, 0)).toEqual({ p: 0, c: 0, f: 0 })
  })

  it('MacroVials: the gram is the number, the energy share is the level and the note; a missing gram is honest', () => {
    const onPick = vi.fn()
    const { container, rerender } = render(<MacroVials p={54} c={79} f={15} onPick={onPick} />)
    const vials = container.querySelectorAll('.fx-mv > .fo-vial')
    expect(vials).toHaveLength(3)
    expect(vials[0]).toHaveTextContent('54 gFehérje32% energia')
    fireEvent.click(screen.getByRole('button', { name: 'Szénhidrát: 79 g · az energia 47%-a' }))
    expect(onPick).toHaveBeenCalledWith('carbs')
    rerender(<MacroVials p={null} c={12.5} f={3} />)
    const again = container.querySelectorAll('.fx-mv > .fo-vial')
    expect(again[0]).toHaveTextContent('—Fehérjenincs adat')
    expect(again[1]).toHaveTextContent('12,5 gSzénhidrát')
    expect(container.querySelector('button')).toBeNull()
  })

  it('MealCells: four capsules, the name carries the shares; fibre without data is „—"', () => {
    const { container, rerender } = render(<MealCells protein={54} carbs={79} fat={15} fiber={7} fiberTarget={30} />)
    expect(screen.getByRole('img', { name: 'fehérje 54 g, az étkezés energiájának 32%-a; szénhidrát 79 g, 47%; zsír 15 g, 20%; rost 7 g, a napi adag 23%-a' })).toBeInTheDocument()
    expect([...container.querySelectorAll('.fx-cells > .fo-mini')].map((e) => e.textContent)).toEqual(['54 gfeh.', '79 gszénh.', '15 gzsír', '7 grost'])
    rerender(<MealCells protein={54} carbs={79} fat={15} fiber={null} fiberTarget={30} />)
    expect(screen.getByRole('img', { name: /rost nincs adat$/ })).toBeInTheDocument()
    expect(container.querySelectorAll('.fx-cells > .fo-mini')[3]).toHaveTextContent('—rost')
  })

  it('M3 and Nutri print grams or a dash', () => {
    const { container } = render(<><M3 p={18} c={3.5} f={null} /><Nutri fiber={7} sugar={24} salt={0.3} satFat={null} /></>)
    expect([...container.querySelectorAll('.fx-m3 > span')].map((e) => e.textContent)).toEqual(['18 g feh.', '3,5 g szénh.', '— zsír'])
    expect(container.querySelectorAll('.fx-m3 .fo-level')).toHaveLength(3)
    expect([...container.querySelectorAll('.fx-nut > span')].map((e) => e.textContent)).toEqual(['7 grost', '24 gcukor', '0,3 gsó', '—tel. zsír'])
  })

  it('ScoreChip: the ten scale with one decimal, a button to the rating; pending is passive', () => {
    const onOpen = vi.fn()
    const { container, rerender } = render(<ScoreChip score={8.4} onOpen={onOpen} />)
    const chip = screen.getByRole('button', { name: 'Mezo értékelése: 8,4' })
    expect(chip).toHaveTextContent('8,4')
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
    rerender(<ScoreChip score={null} onOpen={onOpen} />)
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('.fx-chip.sc.pend')).toHaveTextContent('folyamatban')
    // a whole score keeps its decimal („8,0"): the chip, the week's vessels and Mezo's rating all print the same number
    rerender(<ScoreChip score={8} big />)
    expect(screen.getByRole('img', { name: 'Mezo értékelése: 8,0' })).toHaveClass('big')
  })

  it('GlyChip / GlyBand / GlyMini: a band word, never a number', () => {
    const onOpen = vi.fn()
    const { container } = render(<><GlyChip level="mid" onOpen={onOpen} /><GlyBand level="high" /><GlyMini level="low" late /></>)
    const chip = screen.getByRole('button', { name: 'Vércukor-válasz: közepes' })
    expect(chip).toHaveClass('fx-chip', 'mid')
    expect(chip).toHaveTextContent('Közepes')
    expect(chip.querySelector('.fx-gmini')).not.toBeNull()
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalled()
    const band = screen.getByRole('img', { name: 'Vércukor-válasz sávja: magas' })
    expect([...band.children].map((e) => e.textContent)).toEqual(['Alacsony', 'Közepes', 'Magas'])
    expect(band.querySelector('.on')).toHaveClass('high')
    expect(container.querySelector('svg.fx-gmini .late')).not.toBeNull()
    expect(container.textContent).not.toMatch(/\d/)
  })

  it('LineTags: source (+ AI), the review mark, NOVA with its dot, stored extras untouched', () => {
    const { container } = render(<LineTags source="pantry" ai review nova={4} extra={['MyProtein', null, '']} />)
    const tags = [...container.querySelectorAll('.fx-tags > em')]
    expect(tags.map((e) => e.textContent)).toEqual(['kamra · AI', 'nézd át', 'Ultra-feldolgozott', 'MyProtein'])
    expect(tags[1]).toHaveClass('w')
    expect(tags[2].querySelector('i')).not.toBeNull()
  })

  it('ItemRow: the kit row with a full-width second line; nested kit pieces keep their own dress', () => {
    const onClick = vi.fn()
    const { container } = render(
      <ItemRow icon="t-fiber" title="Rost" sub="az adag-cél 100%-a" value="7 g" onClick={onClick}>
        <Level pct={100} height={8} /><St tone="ok">rendben</St>
      </ItemRow>,
    )
    const row = container.querySelector('.fo-row.fx-it')!
    expect(row.tagName).toBe('BUTTON')
    expect(row.querySelector(':scope > .fx-l2 > .fo-level')).not.toBeNull()
    expect(row.querySelector(':scope > .fx-l2 > .fo-st')).toHaveTextContent('rendben')
    // a row that opens something keeps no chevron: the second line is its end
    expect(row.querySelectorAll(':scope > svg')).toHaveLength(0)
    fireEvent.click(row)
    expect(onClick).toHaveBeenCalled()
  })

  it('EditLine: remove, step, type — every control named after the line', () => {
    const onRemove = vi.fn(); const onDec = vi.fn(); const onInc = vi.fn(); const onChange = vi.fn()
    const { container } = render(
      <EditLine icon="t-meat" name="Túró · félzsíros" tags={<LineTags source="pantry" />} onRemove={onRemove}
        amount={{ value: '250', onChange }} unit="g" onDec={onDec} onInc={onInc} kcal={1325} macros={{ p: 45, c: 9, f: 11 }}>
        <Nutri fiber={0} sugar={9} salt={0.3} satFat={7.2} />
      </EditLine>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Túró · félzsíros eltávolítása' }))
    fireEvent.click(screen.getByRole('button', { name: 'Túró · félzsíros csökkentése' }))
    fireEvent.click(screen.getByRole('button', { name: 'Túró · félzsíros növelése' }))
    expect(onRemove).toHaveBeenCalledTimes(1); expect(onDec).toHaveBeenCalledTimes(1); expect(onInc).toHaveBeenCalledTimes(1)
    const input = screen.getByRole('textbox', { name: 'Túró · félzsíros mennyisége' })
    expect(input).toHaveValue('250')
    fireEvent.change(input, { target: { value: '300' } })
    expect(onChange).toHaveBeenCalled()
    expect(container.querySelector('.fx-lnk')).toHaveTextContent('1 325kcal')
    expect([...container.querySelectorAll('.fx-lnm > span')].map((e) => e.textContent)).toEqual(['45 gfeh.', '9 gszénh.', '11 gzsír'])
    expect(container.querySelector('.fx-ln > .fx-nut')).not.toBeNull()
  })

  it('EditLine: an unresolved line prints dashes', () => {
    const { container } = render(<EditLine icon="t-carb" name="Zab" amount={{ value: '', onChange: () => {} }} unit="g" onDec={() => {}} onInc={() => {}} kcal={null} macros={null} />)
    expect(container.querySelector('.fx-lnk > b')).toHaveTextContent('—')
    expect([...container.querySelectorAll('.fx-lnm b')].map((e) => e.textContent)).toEqual(['—', '—', '—'])
    expect(container.querySelector('.fx-x')).toBeNull()
  })

  it('Kv, Tip, Lgd, NumG, SplitBar, Strip', () => {
    const onClick = vi.fn()
    const { container } = render(
      <>
        <Kv items={[['Tanult alap', '2 480 kcal'], ['Képlet', '2 400 kcal']]} />
        <Tip icon="t-fiber" title="Rost előre">Pár falat zöldség a szénhidrát előtt.</Tip>
        <Lgd items={[['liq', 'amit ettél'], ['dash', 'keret'], ['gap', 'nincs felírva']]} />
        <NumG graphic={<Pot pct={40} />} value="689" unit="kcal"><p>a nap <b>22%-a</b></p></NumG>
        <SplitBar parts={[{ label: 'Fehérje', pct: 32, color: 'var(--fx-protein)' }, { label: 'Zsír', pct: 0, color: 'var(--fx-fat)', value: '0 g' }]} />
        <Strip icon="t-kimelo" onClick={onClick} ariaLabel="Kímélő mód, gyomorrontás, 2. nap"><b>Kímélő mód</b> · Gyomorrontás · 2. nap</Strip>
        <Strip icon="t-history">Amit itt logolsz, tegnapra könyvelődik.</Strip>
      </>,
    )
    expect([...container.querySelectorAll('.fx-kv > div')].map((e) => e.textContent)).toEqual(['Tanult alap2 480 kcal', 'Képlet2 400 kcal'])
    expect(container.querySelector('.fx-tip')).toHaveTextContent('Rost előrePár falat zöldség a szénhidrát előtt.')
    expect([...container.querySelectorAll('.fx-lg > span > i')].map((e) => e.className)).toEqual(['liq', 'dash', 'gap'])
    expect(container.querySelector('.fx-ng-n')).toHaveTextContent('689kcal')
    expect(container.querySelectorAll('.fx-split > i')).toHaveLength(1)
    expect([...container.querySelectorAll('.fx-leg > span')].map((e) => e.textContent)).toEqual(['Fehérje32%', 'Zsír0 g'])
    const strip = screen.getByRole('button', { name: 'Kímélő mód, gyomorrontás, 2. nap' })
    fireEvent.click(strip)
    expect(onClick).toHaveBeenCalled()
    expect(container.querySelectorAll('div.fx-kms')).toHaveLength(1)
  })

  // The pieces the areas had built beside the shared ones, folded in by the integration step (bible F2.4 / F3.6).
  it('folded twins: a bare Tip, Kv options, the clock / week swatches, Tot, a link Strip, MacroTriple with kcal, MealCells with a missing gram', () => {
    const { container } = render(
      <MemoryRouter>
        <Tip icon="t-bolt">Reggelire időzítve, mert éhgyomorra szívódik fel.</Tip>
        <Kv spanLast className="x" items={[['a', '1'], ['b', '2'], ['c', '3']]} />
        <Lgd center className="y" items={[['oth', 'többi ablak'], ['trn', 'edzés'], ['ngt', 'alvás'], ['we', 'hétvége'], ['rec', 'kímélő nap'], ['trd', 'edzésnap']]} />
        <Tot data-row="remaining" label="Marad" sub="a mai keretből" value="742" unit="kcal" />
        <Strip icon="t-ring" warn to="/me/goals/weight" className="z"><b>Javaslat vár</b></Strip>
        <MacroTriple kcal={356} p={29} c={31} f={13} />
        <MacroTriple className="w" kcal={null} p={null} c={2} f={3} />
        <MealCells protein={36} carbs={null} fat={null} fiber={null} fiberTarget={30} />
      </MemoryRouter>,
    )
    const tip = container.querySelector('.fx-tip')!
    expect(tip).toHaveClass('bare')
    expect(tip.querySelector('b')).toBeNull()
    expect(tip.querySelector('small')).toHaveTextContent('Reggelire időzítve')
    expect(container.querySelector('.fx-kv')).toHaveClass('span-last', 'x')
    expect(container.querySelector('.fx-lg')).toHaveClass('center', 'y')
    expect([...container.querySelectorAll('.fx-lg > span > i')].map((e) => e.className)).toEqual(['oth', 'trn', 'ngt', 'we', 'rec', 'trd'])
    for (const kind of ['oth', 'trn', 'ngt', 'we', 'rec', 'trd']) expect(CSS, kind).toContain(`.fx-lg > span > i.${kind} {`)
    const tot = container.querySelector('.fx-tot')!
    expect(tot).toHaveAttribute('data-row', 'remaining')
    expect(tot.querySelector(':scope > span')!.textContent).toBe('Marada mai keretből')
    expect(tot.querySelector(':scope > b')!.textContent).toBe('742kcal')
    const link = screen.getByRole('link', { name: 'Javaslat vár' })
    expect(link).toHaveAttribute('href', '/me/goals/weight')
    expect(link).toHaveClass('fx-kms', 'warn', 'z')
    const [withKcal, unknown] = [...container.querySelectorAll('.fx-lnm')]
    expect([...withKcal.children].map((e) => e.textContent)).toEqual(['356kcal', '29 gfeh.', '31 gszénh.', '13 gzsír'])
    expect(unknown).toHaveClass('w')
    expect([...unknown.querySelectorAll('b')].map((e) => e.textContent)).toEqual(['—', '—', '2 g', '3 g'])
    // a missing gram: every capsule is empty (no energy split from a truncated composition), and the name says what is known
    const cells = container.querySelector('.fx-cells')!
    expect(cells).toHaveAccessibleName('fehérje 36 g; szénhidrát nincs adat; zsír nincs adat; rost nincs adat')
    expect([...cells.querySelectorAll('.fo-mini b')].map((e) => e.textContent)).toEqual(['36 g', '—', '—', '—'])
  })

  it('speaks English and follows a runtime switch on the same node', () => {
    const { container } = render(
      <>
        <BowlGauge eaten={2060} target={3100} rem={1040} skipped={390} />
        <SlotCup kcal={0} budget={1005} />
        <MacroVials p={54} c={79} f={15} />
        <MealCells protein={54} carbs={79} fat={15} fiber={7} fiberTarget={30} />
        <M3 p={18} c={3.5} f={4.5} />
        <ScoreChip score={8.4} onOpen={() => {}} /><ScoreChip score={null} />
        <GlyChip level="high" onOpen={() => {}} /><GlyBand level="low" />
        <LineTags source="estimate" review nova={1} />
        <Nutri fiber={7} sugar={24} salt={0.3} satFat={6.2} />
      </>,
    )
    expect(container).toHaveTextContent('kcal-t ettél')
    act(() => setLang('en', { persist: false }))
    expect(screen.getByRole('img', { name: '2,060 / 3,100 kcal, 390 kcal of it skipped' })).toHaveTextContent('budget 3,100 kcal')
    expect(container.querySelector('.fx-bg-n')).toHaveTextContent('2,060kcal eaten')
    expect(screen.getByRole('img', { name: 'Budget: 1,005 kcal' })).toHaveTextContent('1,005budget')
    expect(container.querySelector('.fx-mv > .fo-vial')).toHaveTextContent('54 gProtein32% of energy')
    expect(screen.getByRole('img', { name: 'protein 54 g, 32% of the meal’s energy; carbs 79 g, 47%; fat 15 g, 20%; fibre 7 g, 23% of the daily amount' })).toBeInTheDocument()
    expect(container.querySelector('.fx-m3')).toHaveTextContent('18 g prot.3.5 g carbs4.5 g fat')
    expect(screen.getByRole('button', { name: 'Mezo’s rating: 8.4' })).toHaveTextContent('8.4')
    expect(container.querySelector('.fx-chip.pend')).toHaveTextContent('in progress')
    expect(screen.getByRole('button', { name: 'Blood sugar response: high' })).toHaveTextContent('High')
    expect(screen.getByRole('img', { name: 'Blood sugar response band: low' })).toHaveTextContent('LowMediumHigh')
    expect([...container.querySelectorAll('.fx-tags > em')].map((e) => e.textContent)).toEqual(['estimate', 'check it', 'Whole food'])
    expect(container.querySelector('.fx-nut')).toHaveTextContent('7 gfibre24 gsugar0.3 gsalt6.2 gsat. fat')
    expect(container.textContent).not.toMatch(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/)
    act(() => setLang('hu', { persist: false }))
    expect(container.querySelector('.fx-bg-n')).toHaveTextContent('2 060kcal-t ettél')
  })

  it('the shared sheet: every rule speaks `.fx-` (or dresses a kit piece inside one), buttons own 44 px, motion is opt-in', () => {
    const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const selectors = css.replace(/@media[^{]*\{/g, '').replace(/@keyframes[^{]*\{[^}]*\{[^}]*\}\s*\}/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean)
    const strangers = selectors.flatMap((s) => s.split(',').map((x) => x.trim())).filter((s) => s && !/\.fx-|^:root$|^to$/.test(s))
    expect(strangers).toEqual([])
    for (const sel of ['button.fx-chip::after', '.fx-x::after']) expect(css).toMatch(new RegExp(sel.replace(/[.:]/g, '\\$&') + ' \\{[^}]*44px'))
    const still = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g, '')
    expect(still).not.toMatch(/animation\s*:|transition\s*:/)
  })
})
