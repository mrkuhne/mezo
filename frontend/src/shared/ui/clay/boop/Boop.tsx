// ============================================================
// Mezo · Boop — a ház kabalafigurája, példányonként inline SVG-ként (mezo-ju4j6.15).
//
// MIÉRT INLINE, és nem `<use>` a sprite-ból (ahogy a ClayIcon teszi)? Mert a figura MOZOG,
// és a CSS egy `<use>` árnyék-fájába nem lát be: a szabályok a `<symbol>` FORRÁS elemeire
// illeszkednek, tehát minden példány EGYSZERRE mozogna, és egy példányt sem lehetne külön
// állítani (a navigációban és a Nap közepén is él). Példányonként befűzött
// markupnál a `.boop-pupil` / `.boop-brow` / `.boop-body` fogók a saját példányukhoz tartoznak.
//
// A gradiens-azonosítók példányonként ELŐTAGOT kapnak (`useId`): két különböző domain Boopja
// egyszerre van a képernyőn (menü = aktuális terület, Nap közepe = levendula), és azonos id
// esetén az SVG a DOKUMENTUM első találatát használná — a két figura egymás színét viselné.
//
// A mozdulatok (pislogás · tekintet · szemöldök · lélegzet) a `prototype.css` `boop` blokkjában élnek,
// `prefers-reduced-motion: no-preference` ág alatt.
// ============================================================
import { useId, useMemo } from 'react'
import type React from 'react'
import boopRaw from './boop.svg?raw'
import { cn } from '@/shared/lib/cn'

/** A NAVIGÁCIÓ domain-azonosítói (navModel `DOMAINS`), nem a sprite szimbólum-nevei:
 *  a hívó azt adja át, amit amúgy is a kezében tart. */
export type BoopDomain = 'nap' | 'train' | 'fuel' | 'mezo' | 'me'

/** Minden rajzolható figura: a navigációs területek + a csapat-üzenőfal két karakter-szerepe
 *  (arany Mezo, palaszürke Szkeptikus — mezo-a9bo7.9). Külön típus, hogy a navigáció
 *  azonosítói közé ne csússzon be egy nem-terület. */
export type BoopVariant = BoopDomain | 'gold' | 'slate'

/** domain → szimbólum. Az Én területé `boop-en` (a `me` a route, az `en` a szín neve) —
 *  ez az EGY eltérés, és pont ez ejtette ki némán az Én sorát az első körben. */
const SYMBOL: Record<BoopVariant, string> = {
  nap: 'boop-nap', train: 'boop-train', fuel: 'boop-fuel', mezo: 'boop-mezo', me: 'boop-en',
  gold: 'boop-gold', slate: 'boop-slate',
}

/** A sprite EGYSZER, modul-szinten szétszedve: a közös `<defs>` és domainenként a törzs. */
const SPRITE = (() => {
  const defs = boopRaw.match(/<defs>([\s\S]*?)<\/defs>/)?.[1] ?? ''
  const bodies = new Map<string, string>()
  for (const m of boopRaw.matchAll(/<symbol id="(boop-[a-z]+)"[^>]*>([\s\S]*?)<\/symbol>/g)) {
    bodies.set(m[1], m[2])
  }
  return { defs, bodies }
})()

/** Csak annak a domainnek a gradiensei, amit ez a példány tényleg használ. */
function defsFor(symbolId: string): string {
  return SPRITE.defs
    .split(/(?=<(?:radial|linear)Gradient)/)
    .filter(chunk => chunk.includes(`id="bg-${symbolId}-`))
    .join('')
}

/** Példányonként elcsúsztatott mozdulat-fázis (0 … −8,5 s), hogy egy képernyőnyi Boop ne
 *  pislogjon egyszerre (owner, 2026-09-26: „mindenhol, ahol Mezo avatar van, legyen animált”). */
function phaseOf(uid: string): string {
  let h = 0
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `${-((h % 18) * 0.5)}s`
}

export function Boop({ domain, size = 44, alive = true, className }: {
  domain: BoopVariant
  size?: number
  /** Él-e a figura: pislogás + tekintet + szemöldök + lélegzet. Alapból IGEN (U10, owner
   *  2026-09-26): minden Boop él; `alive={false}` csak egy tudatosan álló figurának jár. */
  alive?: boolean
  className?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const symbolId = SYMBOL[domain]
  const html = useMemo(() => {
    const body = SPRITE.bodies.get(symbolId) ?? ''
    // `bg-boop-nap-body` → `bg-<példány>-boop-nap-body`, a definícióban és a hivatkozásban is.
    const scope = (s: string) => s.replace(/bg-boop-/g, `bg-${uid}-boop-`)
    return `<defs>${scope(defsFor(symbolId))}</defs>${scope(body)}`
  }, [symbolId, uid])

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('boop', alive && 'is-alive', className)}
      style={alive ? ({ '--boop-delay': phaseOf(uid) } as React.CSSProperties) : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
