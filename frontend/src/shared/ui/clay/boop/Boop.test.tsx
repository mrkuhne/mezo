// ============================================================
// Mezo · Boop — a példányonkénti befűzés őre (mezo-ju4j6.15).
//
// Két dolgot kell őrizni, mert mindkettő NÉMÁN romlik el:
//  1. a figura markupja tényleg a példányban van (nem `<use>`), különben a CSS nem éri el a
//     mozdulat-fogókat, és vagy minden Boop egyszerre mozogna, vagy egyik sem;
//  2. a gradiens-azonosítók példányonként egyediek — két különböző domain Boopja egyszerre
//     van a képernyőn (menü = aktuális terület, Nap közepe = levendula), és ütköző id-nél az
//     SVG a dokumentum ELSŐ definícióját használná: a két figura egymás színét viselné.
// ============================================================
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DOMAINS } from '@/app/navModel'
import { Boop } from './Boop'

describe('Boop', () => {
  test('a markup a példányban él, nem `<use>` hivatkozás', () => {
    const { container } = render(<Boop domain="nap" />)
    const svg = container.querySelector('svg.boop')!
    expect(svg.querySelector('use')).toBeNull()
    for (const part of ['.boop-pupil', '.boop-brow', '.boop-body', '.boop-ear']) {
      expect(svg.querySelector(part), `${part} hiányzik a befűzött figurából`).not.toBeNull()
    }
  })

  test('csak az `alive` példány visel mozgás-osztályt', () => {
    const { container } = render(<><Boop domain="nap" /><Boop domain="mezo" alive /></>)
    const [quiet, alive] = Array.from(container.querySelectorAll('svg.boop'))
    expect(quiet.classList.contains('is-alive')).toBe(false)
    expect(alive.classList.contains('is-alive')).toBe(true)
  })

  test('két példány gradiens-azonosítói NEM ütköznek', () => {
    const { container } = render(<><Boop domain="nap" /><Boop domain="train" /></>)
    const [a, b] = Array.from(container.querySelectorAll('svg.boop'))
    const ids = (svg: Element) => Array.from(svg.querySelectorAll('[id]')).map(el => el.id)
    const idsA = ids(a), idsB = ids(b)
    expect(idsA.length).toBeGreaterThan(0)
    expect(idsA.some(id => idsB.includes(id))).toBe(false)
    // és a hivatkozás a SAJÁT definícióra mutat
    const fill = a.querySelector('[fill^="url(#"]')!.getAttribute('fill')!
    expect(idsA).toContain(fill.slice(5, -1))
  })

  // A NAVIGÁCIÓ öt területéből indul, nem egy kézzel írt listából: a sáv és a területváltó
  // ezeket rajzolja, és egy hiányzó változat NÉMÁN, üres jellel renderelne (pontosan ez történt
  // az Én területével, amelynek azonosítója `me`, a színváltozaté viszont `boop-en`).
  test('a navigáció MINDEN területének van figurája', () => {
    expect(DOMAINS).toHaveLength(5)
    for (const domain of DOMAINS) {
      const { container } = render(<Boop domain={domain.id} />)
      const svg = container.querySelector('svg.boop')!
      expect(svg.innerHTML, `${domain.id} üres`).toContain('boop-body')
      expect(svg.querySelector('[fill^="url(#"]'), `${domain.id} gradiens nélkül`).not.toBeNull()
    }
  })
})
