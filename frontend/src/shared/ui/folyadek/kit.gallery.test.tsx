import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as K from './index'

it('renders every export once with realistic props and logs no console error', () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const D = 'M50 8C70 8 92 24 92 48 92 76 72 94 50 94 28 94 8 76 8 48 8 24 30 8 50 8Z'
  const { container } = render(
    <MemoryRouter><K.FrameProvider>
      <K.Hero label="Mai állapot" verdict="Ma jó nap egy közepes edzéshez." sub="Hét óra negyven alvás." actions={<button className="btn">Check-in</button>} />
      <K.Hero verdict="Nincs adat." warn />
      <K.Hero label="Mezo" verdict="Három új üzenet." sub="Kettő választ vár." left={<K.Badge member="mezo" size={64} />} role="group" aria-label="Üzenetek" />
      <K.Section n={1} title="Mai szintek" link="Mind" />
      <K.Card><K.Row icon="t-flame" title="Kalória" sub="1 040 van még" value="2 060" onClick={() => {}} right={<K.Mini pct={66} />} /></K.Card>
      <K.Tank pct={68} num="68" cap="pont" label="Mai állapot" verdict="Jó nap" marks={[100, 50, 0]} cta="Délutáni check-in" onCta={() => {}} />
      <K.Vials items={[{ label: 'Kalória', value: '2 060', pct: 66, icon: 't-flame', color: '#1877F2', mark: '3 100', note: '1 040 van még' }, { label: 'Fehérje', value: '148 g', pct: 67, icon: 't-meat', color: '#E8615C' }]} />
      <K.Level pct={60} value="60%" label="Fehérje" />
      <K.Fill d={D} pct={55} size={120}><text>x</text></K.Fill>
      <K.Area values={[5, 6, 7, 6.5, 7.5]} dots={[5, null, 7, 6, 8]} target={7} labels={['H', 'K', 'Sze', 'Cs', 'P']} />
      <K.Linked a={42} b={80} labelA="késői vacsora" labelB="korai vacsora" valueA="6,0" valueB="7,5" />
      <K.Stream items={[{ time: '14:00', title: 'Check-in', sub: '8 koppintás', right: 'Kitöltöm', now: true }, { time: '18:00', title: 'Röpi edzés' }]} />
      <K.PerDay days={[{ label: '4.', pct: 40, group: 'a' }, { label: '5.', pct: 80, group: 'b', against: true }]} />
      <K.Bub icon="t-heart" />
      {(['szunya', 'mocor', 'falat', 'deru', 'mezo', 'szk'] as const).map((m) => <K.Badge key={m} member={m} pct={50} />)}
      <K.Drop pct={57} color="#1877F2" alive />
      <K.Page data-testid="pg" tone="dusk" foot={<><K.Lk>Kilépés</K.Lk><K.Btn grow>Tovább</K.Btn></>} nonav>
        <K.Dots count={6} at={2} core={5} label="3 / 6" />
        <K.Seg aria-label="Napszak" items={[{ key: 'reggel', label: 'Reggel', dot: true }, { key: 'este', label: 'Este' }]} value="reggel" onChange={() => {}} />
        <K.Hero verdict="Tegyük le a napot." actions={<><K.Btn icon="t-moon">Napzárás</K.Btn><K.Btn ghost>Később</K.Btn><K.Lk>Miért?</K.Lk></>}>
          <K.Facts items={[['7 ó 40', 'alvás'], ['148 g', 'fehérje'], ['3/4', 'check-in']]} />
          <K.Chips lead="Ma" items={['korai vacsora', 'séta']} />
          <K.DropChain big aria-label="A heted" items={[{ state: 'done', label: 'H' }, { state: 'now', label: 'K', ariaLabel: 'Kedd, ma', onClick: () => {} }, { state: 'missed', label: 'Sze' }, { label: 'Cs' }]} />
          <K.Vials size="xs" items={['Étel', 'Víz', 'Alvás', 'Mozgás', 'Kapcsolat', 'Rend'].map((label, i) => ({ label, value: 40 + i * 10, pct: 40 + i * 10, icon: 't-bowl' as const, mark: i ? undefined : 'figyelj' }))} />
        </K.Hero>
        <K.Card data-testid="card" aria-label="Rutin">
          <K.Head icon="t-sun" title="Reggeli rutin" link="Szerkesztés" onLink={() => {}} />
          <K.Row left={<K.Tick on label="Ébredés időben · kész" onClick={() => {}} />} title="Ébredés időben" sub="6:35" state="done" as="div" onClick={() => {}} right={<K.St tone="ok">kész</K.St>} />
          <K.Row left={<K.Mark state="now" />} title="Reggeli napfény" state="now" more={<K.Level pct={40} height={12} />} value={<>4<small>perc</small></>} />
          <K.Row left={<K.Mark state="done" label="kész" />} icon="t-water" title="Egy pohár víz" state="dim" />
          <K.Row left={<K.Mark state="empty" size="tick" />} title="Gombakávé" right={<K.Mini pct={30} value="30%" />} data-testid="row" />
          <K.Row to="/nap/rutin/epites" icon="t-chain" title="Rutinok szerkesztése" right={<K.Chev />} />
          <K.ErrorRow message="A rutint most nem sikerült betölteni." onRetry={() => {}} retryLabel="Újrapróbálom" />
          <K.Note>A sorrendet a Rutin szerkesztésénél állítod.</K.Note>
        </K.Card>
        <K.Card>
          <K.Step time="21:45" icon="t-sleep" title="Lecsendesítés" sub="képernyők le" now right={<K.Btn sm>Indítom</K.Btn>} onClick={() => {}} />
          <K.Step time="22:30" icon="t-moon" title="Villanyoltás" onClick={() => {}} />
          <K.Step title="Jó éjszakát" />
        </K.Card>
        <K.Card>
          <K.Lab id="q">Mennyi energia van benned most?</K.Lab>
          <K.Scale aria-labelledby="q" value={7} onPick={() => {}} />
          <K.Ends low="Üres" high="Tele" />
          <K.Lab htmlFor="f">Megjegyzés</K.Lab>
          <K.Input id="f" placeholder="pl. nyugodt tempó" />
          <K.TextArea aria-label="Jegyzet" rows={2} />
          <K.Select aria-label="Napszak"><option>Reggel</option></K.Select>
          <K.Big value="7" unit="/ 10" note="energia" left={<K.Jar pct={70} size={66} />} right={<K.Bub icon="t-bolt" size={52} />} />
          <K.Big value="2 060" unit="kcal ma" aria-label="Összkép" onClick={() => {}} />
          <K.Pills><K.Pill on icon="t-bolt">Energia</K.Pill><K.Pill>Hangulat <small>· új</small></K.Pill></K.Pills>
          <K.Why icon="t-info">A nap kérdése.</K.Why>
          <K.Txt>Három területről van adat.</K.Txt>
          <K.TwoBtn><K.Btn ghost>Mégse</K.Btn><K.Btn type="submit" disabled>Mentés</K.Btn></K.TwoBtn>
          <K.Acts><K.Btn sm wide>Naplózom</K.Btn></K.Acts>
          {(['q', 'ok', 'warn', 'bad', 'plan'] as const).map((t) => <K.St key={t} tone={t}>{t}</K.St>)}
        </K.Card>
        <K.Card>
          <K.Msg member="szunya" meta="alvás · ma reggel">Hét óra negyvenet aludtál.</K.Msg>
          {(['mocor', 'falat', 'deru', 'mezo', 'szk'] as const).map((m) => <K.Msg key={m} member={m}>Rendben.</K.Msg>)}
          <K.Empty icon="t-journal" actions={<K.Lk>Beszéljünk</K.Lk>}>Az első mai bejegyzésed itt kap helyet.</K.Empty>
          <K.Jar pct={64} text="64" lid />
          <K.Jar pct={7} text="–" />
        </K.Card>
        <K.Tank pct={66} num="87" height={430} tone="dusk" label="Szerda · lezárva" verdict="Jó nap." air="Hajnalban megírom." onAir={() => {}} airLabel="A nap részletei"
          extra={<button type="button" className="fo-tank-shift" aria-expanded={false}><span>alap 89</span><span>a Mezo szerint <b>−2</b></span></button>} />
        <K.FoSheetHead icon="t-sleep" title="Alvás" titleId="sh" sub="Tegnap éjjel" onBack={() => {}} onClose={() => {}} />
        <K.Foot><K.Btn grow>Kész</K.Btn></K.Foot>
      </K.Page>
    </K.FrameProvider></MemoryRouter>,
  )
  expect(container.querySelectorAll('svg').length).toBeGreaterThan(10)
  // every kit export is a component or a constant this gallery knows: a new export must be rendered above
  const rendered = ['Hero', 'Section', 'Card', 'Row', 'Tank', 'Vials', 'Mini', 'Level', 'Fill', 'Area', 'Linked', 'Stream', 'PerDay', 'Bub', 'Badge', 'Drop',
    'Page', 'Foot', 'TwoBtn', 'Btn', 'Lk', 'Acts', 'Pill', 'Pills', 'Seg', 'St', 'Chips', 'Facts', 'Note', 'Txt', 'Why', 'Lab', 'Empty', 'ErrorRow', 'Head',
    'Msg', 'Step', 'Jar', 'DropChain', 'Scale', 'Ends', 'Dots', 'Tick', 'Mark', 'FoSheetHead', 'FrameProvider', 'Chev', 'Input', 'TextArea', 'Select', 'Big']
  const known = [...rendered, 'Wave', 'MEMBER_LABEL', 'FrameBack', 'HistoryBackButton', 'useFrameFallback', 'useFrame', 'useFrameTitle', 'useFrameBack', 'useTitleBarMounted', 'useHasTitleBar']
  expect(Object.keys(K).filter((k) => !known.includes(k))).toEqual([])
  expect(container.querySelector('[data-testid="pg"]')).toHaveClass('fo-page', 'fo-dusk', 'has-foot', 'nonav')
  expect(container.querySelector('[data-testid="card"]')).toHaveAttribute('aria-label', 'Rutin')
  expect(container.querySelectorAll('.fo-foot')).toHaveLength(2)
  expect(container.querySelector('circle[stroke-dasharray]')).toBeNull()
  expect(container.textContent).not.toMatch(/Szunya|Mocor|Falat|Derű/)
  expect(err).not.toHaveBeenCalled()
  expect(warn).not.toHaveBeenCalled()
})
