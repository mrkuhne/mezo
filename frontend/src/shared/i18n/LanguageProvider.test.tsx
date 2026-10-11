import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { mockMe } from '@/data/auth/authMock'
import { LANG_KEY, getLang, setLang, useLang } from './lang'
import { LanguageProvider } from './LanguageProvider'
import { LanguageBoundary } from './LanguageBoundary'

/** One client for the whole test, seeded with the account (language `hu`) so both data modes behave alike. */
function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(ME_QUERY_KEY, { ...mockMe, language: 'hu' })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.removeItem(LANG_KEY)
  setLang('hu', { persist: false })
})

describe('LanguageProvider', () => {
  it('first paint is already in the account language: one render, no remount, no React warning', () => {
    // Mock account language is `hu`; the device store starts as `en` (a non-Hungarian browser).
    setLang('en', { persist: false })
    const Wrapper = makeWrapper()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const seen: string[] = []
    function Child() {
      seen.push(getLang())
      return null
    }
    render(<Wrapper><LanguageProvider><Child /></LanguageProvider></Wrapper>)
    expect(seen).toEqual(['hu'])
    expect(getLang()).toBe('hu')
    expect(document.documentElement.lang).toBe('hu')
    expect(errors).not.toHaveBeenCalled()
  })

  it('a portal target resolved during render is never left in a detached node after a switch', () => {
    const Wrapper = makeWrapper()
    function Host() {
      return <div className="probe-host" />
    }
    function PortalChild() {
      const target = document.querySelector('.probe-host') ?? document.body
      return createPortal(<span data-probe="portal" />, target)
    }
    render(<Wrapper><LanguageProvider><LanguageBoundary><Host /><PortalChild /></LanguageBoundary></LanguageProvider></Wrapper>)
    expect(document.body.contains(document.querySelector('[data-probe="portal"]'))).toBe(true)
    act(() => setLang('en'))
    const node = document.querySelector('[data-probe="portal"]')
    expect(node).not.toBeNull()
    expect(document.body.contains(node)).toBe(true)
    act(() => setLang('hu'))
    expect(document.body.contains(document.querySelector('[data-probe="portal"]'))).toBe(true)
  })

  it('a switch unmounts every child before any new child mounts', () => {
    const Wrapper = makeWrapper()
    const log: string[] = []
    function Tracked({ id }: { id: string }) {
      useEffect(() => {
        log.push(`mount:${id}`)
        return () => { log.push(`unmount:${id}`) }
      }, [id])
      return null
    }
    render(<Wrapper><LanguageProvider><LanguageBoundary><Tracked id="a" /><Tracked id="b" /></LanguageBoundary></LanguageProvider></Wrapper>)
    log.length = 0
    act(() => setLang('en'))
    const lastUnmount = Math.max(...log.map((l, i) => (l.startsWith('unmount') ? i : -1)))
    const firstMount = log.findIndex((l) => l.startsWith('mount'))
    expect(log.filter((l) => l.startsWith('unmount')).length).toBe(2)
    expect(log.filter((l) => l.startsWith('mount')).length).toBe(2)
    expect(lastUnmount).toBeLessThan(firstMount)
  })
  it('a host above the boundary stays mounted across a switch, and the portal lands in that live node', () => {
    const Wrapper = makeWrapper()
    const log: string[] = []
    function Host({ children }: { children: ReactNode }) {
      useEffect(() => {
        log.push('mount:host')
        return () => { log.push('unmount:host') }
      }, [])
      return <div className="probe-host">{children}</div>
    }
    function PortalChild() {
      const target = document.querySelector('.probe-host') ?? document.body
      return createPortal(<span data-probe="portal" />, target)
    }
    render(<Wrapper><LanguageProvider><Host><LanguageBoundary><PortalChild /></LanguageBoundary></Host></LanguageProvider></Wrapper>)
    const host = document.querySelector('.probe-host')!
    // On the very first render the host is not in the DOM yet, so the lookup falls back to the body
    // (the same on a cold start of the app); either way the portal is attached.
    const first = document.querySelector('[data-probe="portal"]')
    expect(document.body.contains(first)).toBe(true)
    act(() => setLang('en'))
    expect(document.querySelector('.probe-host')).toBe(host) // the same node: never remounted
    expect(log).toEqual(['mount:host'])
    const second = document.querySelector('[data-probe="portal"]')
    expect(second).not.toBe(first) // the child below the boundary did remount
    expect(host.contains(second)).toBe(true)
    expect(document.querySelectorAll('[data-probe="portal"]').length).toBe(1)
  })

  it('the provider alone remounts nothing on a switch; its children still follow the language', () => {
    const Wrapper = makeWrapper()
    const log: string[] = []
    function Tracked() {
      const lang = useLang()
      useEffect(() => {
        log.push('mount')
        return () => { log.push('unmount') }
      }, [])
      return <p data-probe="lang">{lang}</p>
    }
    render(<Wrapper><LanguageProvider><Tracked /></LanguageProvider></Wrapper>)
    act(() => setLang('en'))
    expect(log).toEqual(['mount'])
    expect(document.querySelector('[data-probe="lang"]')!.textContent).toBe('en')
  })

  it('writes the device cache when the account language already equals the store', () => {
    setLang('hu', { persist: false })
    expect(localStorage.getItem(LANG_KEY)).toBeNull()
    const Wrapper = makeWrapper() // the account says `hu`, the store already is `hu`
    render(<Wrapper><LanguageProvider><span /></LanguageProvider></Wrapper>)
    expect(localStorage.getItem(LANG_KEY)).toBe('hu')
  })

  it('leaves the device cache alone while the account language is unknown', () => {
    setLang('hu', { persist: false })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    vi.stubEnv('VITE_USE_MOCK', 'false') // real mode with nothing cached: no account yet
    render(<QueryClientProvider client={client}><LanguageProvider><span /></LanguageProvider></QueryClientProvider>)
    expect(localStorage.getItem(LANG_KEY)).toBeNull()
    vi.unstubAllEnvs()
  })
})
