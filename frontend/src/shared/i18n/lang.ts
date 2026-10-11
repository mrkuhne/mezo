import { useSyncExternalStore } from 'react'

export type Lang = 'hu' | 'en'
export const LANGS: readonly Lang[] = ['hu', 'en']
export const LANG_KEY = 'mezo-lang'

/** A supported language for a raw value, or null for anything else (stale cache, garbage). */
export function normalizeLang(raw: unknown): Lang | null {
  return raw === 'hu' || raw === 'en' ? raw : null
}

/** Hungarian devices get Hungarian; every other device gets English. */
export function deviceLang(): Lang {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator.language : ''
    return typeof nav === 'string' && nav.toLowerCase().startsWith('hu') ? 'hu' : 'en'
  } catch {
    return 'en'
  }
}

/** Device cache first, then the device language. Never throws, always a supported language. */
export function resolveInitialLang(): Lang {
  try {
    const cached = normalizeLang(localStorage.getItem(LANG_KEY))
    if (cached) return cached
  } catch {
    /* storage unavailable — fall through to the device */
  }
  return deviceLang()
}

const listeners = new Set<() => void>()
let current: Lang = resolveInitialLang()

function applyHtmlLang(l: Lang): void {
  try {
    document.documentElement.lang = l
  } catch {
    /* no document */
  }
}
applyHtmlLang(current)

export function getLang(): Lang {
  return current
}

export function setLang(l: Lang, opts?: { persist?: boolean }): void {
  const next = normalizeLang(l) ?? deviceLang()
  if (opts?.persist !== false) {
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* ignore */
    }
  }
  applyHtmlLang(next)
  if (next === current) return
  current = next
  listeners.forEach((fn) => fn())
}

let unannounced = false

/**
 * Align the store with an account language that is already known while a component renders:
 * no subscriber is notified (notifying during render is illegal), so the first paint is in the
 * right language. `announceLang` finishes the job from an effect.
 */
export function alignLang(l: Lang): void {
  const next = normalizeLang(l)
  if (!next || next === current) return
  current = next
  unannounced = true
}

/** Persist the cache and `<html lang>` for the current language and tell subscribers about a silent `alignLang`. */
export function announceLang(): void {
  applyHtmlLang(current)
  if (!unannounced) return
  unannounced = false
  try {
    localStorage.setItem(LANG_KEY, current)
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn())
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}
