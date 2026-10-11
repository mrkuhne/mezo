import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { mockMe } from '@/data/auth/authMock'
import { LANG_KEY, getLang, setLang } from './lang'
import { LanguageProvider } from './LanguageProvider'

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
    render(<Wrapper><LanguageProvider><Host /><PortalChild /></LanguageProvider></Wrapper>)
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
    render(<Wrapper><LanguageProvider><Tracked id="a" /><Tracked id="b" /></LanguageProvider></Wrapper>)
    log.length = 0
    act(() => setLang('en'))
    const lastUnmount = Math.max(...log.map((l, i) => (l.startsWith('unmount') ? i : -1)))
    const firstMount = log.findIndex((l) => l.startsWith('mount'))
    expect(log.filter((l) => l.startsWith('unmount')).length).toBe(2)
    expect(log.filter((l) => l.startsWith('mount')).length).toBe(2)
    expect(lastUnmount).toBeLessThan(firstMount)
  })
})
