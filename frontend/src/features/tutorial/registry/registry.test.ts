import { matchRoutes } from 'react-router-dom'
import { routes } from '@/app/router'
import { KALAUZ_REGISTRY, findKalauz, getKalauz } from '@/features/tutorial/registry'

// Stems, not whole words — no trailing \b — so inflections (pl. "kellene", "hibázik", "elbuktad",
// "rosszul") are caught too, not just the dictionary form.
const FORBIDDEN = /\b(kell|muszáj|hib[aá]|elbuk|rossz)/i

test('a /fuel-nek van kalauza, a /fuel/log-nak (még) nincs', () => {
  expect(findKalauz('/fuel')?.id).toBe('fuel')
  expect(findKalauz('/fuel/log')).toBeNull()
  expect(getKalauz('fuel')?.label).toBe('Fuel')
  expect(getKalauz('nincs-ilyen')).toBeNull()
})

test('minden entry route-ja létezik a routerben, az id-k egyediek', () => {
  const ids = new Set<string>()
  for (const e of KALAUZ_REGISTRY) {
    expect(matchRoutes(routes, e.route)).not.toBeNull()
    expect(ids.has(e.id)).toBe(false)
    ids.add(e.id)
    expect(e.version).toBeGreaterThanOrEqual(1)
  }
})

test('hang-lint: nincs tiltott szó, kártyánként legfeljebb 2 mondat, fogalom ≤ 25 szó', () => {
  for (const e of KALAUZ_REGISTRY) for (const c of e.cards) {
    expect(c.voice).not.toMatch(FORBIDDEN)
    expect(c.title).not.toMatch(FORBIDDEN)
    const sentences = c.voice.split(/[.!?…]\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ„])/).length
    expect(sentences).toBeLessThanOrEqual(2)
    if (c.kind === 'fogalom') expect(c.def.split(/\s+/).length).toBeLessThanOrEqual(25)
  }
})
