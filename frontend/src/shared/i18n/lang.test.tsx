import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LANG_KEY, deviceLang, getLang, normalizeLang, resolveInitialLang, setLang, subscribe } from './lang'
import { LanguageProvider } from './LanguageProvider'
import { LanguageBoundary } from './LanguageBoundary'
import { QueryWrapper } from '@/test/queryWrapper'
import { LoadingFallback } from './LoadingFallback'
import { m, plural, useM } from './index'

function stubNav(language: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language)
}

afterEach(() => {
  vi.restoreAllMocks()
  setLang('hu', { persist: false })
})

describe('language resolution', () => {
  it('falls back to a supported language for a stale or foreign cache value', () => {
    for (const device of ['hu-HU', 'en-US']) {
      stubNav(device)
      for (const bad of ['de', '', 'garbage', 'HU']) {
        localStorage.setItem(LANG_KEY, bad)
        expect(resolveInitialLang()).toBe(deviceLang())
      }
    }
    expect(normalizeLang('de')).toBeNull()
    expect(normalizeLang(undefined)).toBeNull()
  })

  it('uses a valid cache value over the device', () => {
    stubNav('hu-HU')
    localStorage.setItem(LANG_KEY, 'en')
    expect(resolveInitialLang()).toBe('en')
  })

  it('maps the device language: hu-HU -> hu, en-US -> en, de-DE -> en', () => {
    stubNav('hu-HU'); expect(deviceLang()).toBe('hu')
    stubNav('en-US'); expect(deviceLang()).toBe('en')
    stubNav('de-DE'); expect(deviceLang()).toBe('en')
  })

  it('survives a throwing localStorage', () => {
    stubNav('hu-HU')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(resolveInitialLang()).toBe('hu')
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => setLang('en')).not.toThrow()
    expect(getLang()).toBe('en')
    expect(() => m()).not.toThrow()
  })
})

describe('the store', () => {
  it('setLang notifies subscribers, writes the cache and <html lang>', () => {
    const fn = vi.fn()
    const off = subscribe(fn)
    setLang('en')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(LANG_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    off()
    setLang('hu')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('persist: false does not touch localStorage', () => {
    setLang('en', { persist: false })
    expect(getLang()).toBe('en')
    expect(localStorage.getItem(LANG_KEY)).toBeNull()
  })
})

describe('the catalog', () => {
  it('m() follows the store; useM re-renders', () => {
    expect(m().frame.loading).toBe('Betöltés…')
    const { result } = renderHook(() => useM())
    expect(result.current.frame.crash.reload).toBe('Újratöltés')
    act(() => setLang('en', { persist: false }))
    expect(result.current.frame.crash.reload).toBe('Reload')
    expect(m().frame.crash.title).toBe('Something went wrong.')
  })

  it('LanguageBoundary remounts its subtree on a language change', () => {
    let mounts = 0
    function Probe() {
      const t = useM()
      mounts += 1
      return <p>{t.frame.loading}</p>
    }
    render(<QueryWrapper><LanguageProvider><LanguageBoundary><Probe /></LanguageBoundary></LanguageProvider></QueryWrapper>)
    expect(screen.getByText('Betöltés…')).toBeInTheDocument()
    const before = mounts
    act(() => setLang('en', { persist: false }))
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(mounts).toBeGreaterThan(before)
  })

  it('plural picks by the language rule', () => {
    setLang('en', { persist: false })
    expect(plural(1, { one: 'day', other: 'days' })).toBe('day')
    expect(plural(2, { one: 'day', other: 'days' })).toBe('days')
    setLang('hu', { persist: false })
    expect(plural(1, { one: 'nap', other: 'nap' })).toBe('nap')
  })
})

describe('LoadingFallback', () => {
  it('follows the language switch', () => {
    render(<QueryWrapper><LanguageProvider><LoadingFallback /></LanguageProvider></QueryWrapper>)
    expect(screen.getByText('Betöltés…')).toBeInTheDocument()
    act(() => setLang('en', { persist: false }))
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
