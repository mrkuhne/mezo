import { render } from '@testing-library/react'
import * as K from './index'

it('renders every export once with realistic props and logs no console error', () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const D = 'M50 8C70 8 92 24 92 48 92 76 72 94 50 94 28 94 8 76 8 48 8 24 30 8 50 8Z'
  const { container } = render(
    <K.FrameProvider>
      <K.Hero label="Mai állapot" verdict="Ma jó nap egy közepes edzéshez." sub="Hét óra negyven alvás." actions={<button className="btn">Check-in</button>} />
      <K.Hero verdict="Nincs adat." warn />
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
    </K.FrameProvider>,
  )
  expect(container.querySelectorAll('svg').length).toBeGreaterThan(10)
  expect(err).not.toHaveBeenCalled()
  expect(warn).not.toHaveBeenCalled()
})
