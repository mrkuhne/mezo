import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { Bub, Card, Hero, Row, SearchField, Stat, StatGrid, Switch } from './index'

const KIT_CSS = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../styles/folyadek-kit.css'), 'utf8')

afterEach(() => setLang('hu', { persist: false }))

describe('folyadék kit · F5 pieces (mezo-n4wf5.5)', () => {
  it('Stat: caption, numeral with its unit, a note — and the tile fills to `pct` in its colour', () => {
    const { container } = render(
      <StatGrid>
        <Stat label="Alapanyag-arány" value="88" unit="%" pct={88} color="var(--fx-carb)" icon="t-processing" note="rendben" />
        <Stat label="Energiasűrűség" value="—" note="nincs adat" />
      </StatGrid>,
    )
    const [a, b] = [...container.querySelectorAll('.fo-stats > .fo-stat')] as HTMLElement[]
    expect(a.tagName).toBe('DIV')
    expect(a).toHaveClass('lv')
    expect(a.style.getPropertyValue('--p')).toBe('88%')
    expect(a.style.getPropertyValue('--c')).toBe('var(--fx-carb)')
    expect(a.querySelector(':scope > .fo-stat-k')).toHaveTextContent('Alapanyag-arány')
    expect(a.querySelector(':scope > .fo-stat-n')).toHaveTextContent('88%')
    expect(a.querySelector(':scope > .fo-stat-n > small')).toHaveTextContent('%')
    expect(a.querySelector(':scope > .fo-stat-ic use, :scope > .fo-stat-ic svg')).not.toBeNull()
    expect(a.querySelector(':scope > .fo-stat-s')).toHaveTextContent('rendben')
    // no level: no liquid, no `--p`
    expect(b).not.toHaveClass('lv')
    expect(b.style.getPropertyValue('--p')).toBe('')
    expect(b.querySelector('.fo-stat-n > small')).toBeNull()
  })

  it('Stat clamps the level and is a button when it has an action', () => {
    const onClick = vi.fn()
    render(<Stat label="Víz" value="3,1" unit="l" pct={140} onClick={onClick} data-testid="s" />)
    const tile = screen.getByRole('button', { name: /Víz/ })
    expect(tile.style.getPropertyValue('--p')).toBe('100%')
    expect(tile).toHaveAttribute('data-testid', 's')
    fireEvent.click(tile)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Stat takes a node as its value: a nested kit piece is not re-dressed by the tile (bible F3.9)', () => {
    const { container } = render(<Stat label="x" value={<Bub icon="t-water" size={24} />} unit="l" />)
    expect(container.querySelector('.fo-stat-n > .fo-bub')).not.toBeNull()
    // every tile rule addresses its own children
    const rules = KIT_CSS.split('\n').filter((l) => l.startsWith('.fo-stat') && l.includes(' .'))
    expect(rules.filter((l) => /^\.fo-stat[^{]*\s\.(?!fo-stat)/.test(l.replace(/\s>\s/g, '>')))).toEqual([])
  })

  it('Switch: a named role=switch that reports the next state; the kit owns its 44 px touch area', () => {
    function Host() {
      const [on, setOn] = useState(false)
      return <Row as="div" title="Tanulás" onClick={() => {}} right={<Switch on={on} onChange={setOn} label="Tanulás bekapcsolása" />} />
    }
    render(<Host />)
    const sw = screen.getByRole('switch', { name: 'Tanulás bekapcsolása' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw).toHaveClass('fo-sw', 'on')
    expect(KIT_CSS).toMatch(/\.fo-sw::before \{[^}]*height: 44px/)
  })

  it('Switch: disabled does not fire', () => {
    const onChange = vi.fn()
    render(<Switch on onChange={onChange} label="x" disabled />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('SearchField: named by its placeholder, reports typing, and clears with its own button (in the app language)', () => {
    function Host() {
      const [q, setQ] = useState('')
      return <Card><SearchField value={q} onChange={setQ} placeholder="Keress a kamrában" /></Card>
    }
    render(<Host />)
    const input = screen.getByRole('searchbox', { name: 'Keress a kamrában' })
    expect(screen.queryByRole('button', { name: 'Keresés törlése' })).toBeNull()
    fireEvent.change(input, { target: { value: 'túró' } })
    expect(input).toHaveValue('túró')
    fireEvent.click(screen.getByRole('button', { name: 'Keresés törlése' }))
    expect(input).toHaveValue('')
    expect(KIT_CSS).toMatch(/\.fo-srch > button::after \{[^}]*width: 44px; height: 44px/)
  })

  it('SearchField speaks English, and an explicit aria-label wins over the placeholder', () => {
    setLang('en', { persist: false })
    render(<Hero verdict="v"><SearchField value="oats" onChange={() => {}} placeholder="Search" aria-label="Search the pantry" /></Hero>)
    expect(screen.getByRole('searchbox', { name: 'Search the pantry' })).toHaveValue('oats')
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })

  it('motion of the new pieces lives in the reduced-motion branch only', () => {
    const f5 = KIT_CSS.slice(KIT_CSS.indexOf('Folyadék F5 (mezo-n4wf5.5)'))
    const still = f5.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g, '')
    expect(still).not.toMatch(/animation\s*:|transition\s*:/)
  })
})
