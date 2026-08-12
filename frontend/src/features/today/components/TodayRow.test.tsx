import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { TodayRow } from '@/features/today/components/TodayRow'

describe('TodayRow — a négy kísérő', () => {
  test('tick: pipáló karika, a sor címét tartalmazó akadálymentes névvel', async () => {
    const onAction = vi.fn()
    render(<TodayRow tone="habit" icon="💪" title="50 fekvőtámasz" accessory="tick" onAction={onAction} />)
    const tick = screen.getByRole('button', { name: /50 fekvőtámasz/ })
    await userEvent.click(tick)
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('button: tintás szöveggomb a saját feliratával', async () => {
    const onAction = vi.fn()
    render(<TodayRow tone="fuel" icon="🍳" title="Fehérjés reggeli" accessory="button"
                     actionLabel="Logolás" onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Logolás' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('chevron: az EGÉSZ sor a gomb', async () => {
    const onAction = vi.fn()
    render(<TodayRow tone="plain" icon="✦" title="Szándékkal élted a napot?" accessory="chevron"
                     onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: /Szándékkal élted a napot\?/ }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('none: olvasható sor, semmilyen gomb nélkül', () => {
    render(<TodayRow tone="plain" icon="✦" title="Jelen lenni" accessory="none" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Jelen lenni')).toBeInTheDocument()
  })
})

describe('TodayRow — az ItemRow-tól átvett viselkedési szabályok', () => {
  test('`actionLabel` `onAction` nélkül inert szöveg, sosem halott gomb', () => {
    render(<TodayRow tone="habit" icon="💪" title="50 fekvőtámasz" accessory="button" actionLabel="Még vár" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Még vár')).toBeInTheDocument()
  })

  test('`disabled` VISSZAVONJA a kontrollt (nem halványítja) — semmi nem marad kattintható', () => {
    const onAction = vi.fn()
    render(<TodayRow tone="habit" icon="💪" title="50 fekvőtámasz" accessory="tick"
                     onAction={onAction} disabled />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('`linkUrl` az akció MELLETT áll, és nincs a sor gombján BELÜL', () => {
    const onAction = vi.fn()
    render(<TodayRow tone="habit" icon="🎬" title="Reggeli videó" accessory="chevron"
                     onAction={onAction} linkUrl="https://example.com/v" />)
    const link = screen.getByRole('link', { name: /Reggeli videó megnyitása/ })
    const hit = screen.getByRole('button', { name: /Reggeli videó/ })
    expect(link).toBeInTheDocument()
    expect(hit).not.toContainElement(link) // sosem beágyazva
  })

  test('`done` sor: áthúzott cím + telt karika, de az IKON NEM cserélődik ✓-ra', () => {
    render(<TodayRow tone="habit" icon="💪" title="50 fekvőtámasz" accessory="tick" done />)
    expect(screen.getByText('💪')).toBeInTheDocument()
    expect(screen.getByText('50 fekvőtámasz')).toBeInTheDocument()
  })

  test('az alsó sor és az idő is megjelenik', () => {
    render(<TodayRow tone="check" icon="💗" title="Hogy vagy?" subtitle="4 kérdés"
                     time="14:00" accessory="none" />)
    expect(screen.getByText('4 kérdés')).toBeInTheDocument()
    expect(screen.getByText('14:00')).toBeInTheDocument()
  })
})
