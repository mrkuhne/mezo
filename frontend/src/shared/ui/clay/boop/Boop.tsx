// ============================================================
// Mezo · Boop — a ház kabalafigurája, példányonként inline SVG-ként (mezo-ju4j6.15).
//
// MIÉRT INLINE, és nem `<use>` a sprite-ból (ahogy a ClayIcon teszi)? Mert a figura MOZOG,
// és a CSS egy `<use>` árnyék-fájába nem lát be: a szabályok a `<symbol>` FORRÁS elemeire
// illeszkednek, tehát minden példány EGYSZERRE mozogna, és egy példányt sem lehetne külön
// állítani (a menü-ikon nyugalomban áll, a Nap közepén viszont él). Példányonként befűzött
// markupnál a `.boop-pupil` / `.boop-brow` / `.boop-body` fogók a saját példányukhoz tartoznak.
//
// A gradiens-azonosítók példányonként ELŐTAGOT kapnak (`useId`): két különböző domain Boopja
// egyszerre van a képernyőn (menü = aktuális terület, Nap közepe = levendula), és azonos id
// esetén az SVG a DOKUMENTUM első találatát használná — a két figura egymás színét viselné.
//
// A mozdulatok (tekintet · szemöldök · lélegzet) a `prototype.css` `boop` blokkjában élnek,
// `prefers-reduced-motion: no-preference` ág alatt. Pislogás SZÁNDÉKOSAN nincs (owner
// 2026-09-18) — a stíluskönyv §6.4 rögzíti.
// ============================================================
import { useId, useMemo } from 'react'
import boopRaw from './boop.svg?raw'
import { cn } from '@/shared/lib/cn'

/** A NAVIGÁCIÓ domain-azonosítói (navModel `DOMAINS`), nem a sprite szimbólum-nevei:
 *  a hívó azt adja át, amit amúgy is a kezében tart. */
export type BoopDomain = 'nap' | 'train' | 'fuel' | 'mezo' | 'me'

/** domain → szimbólum. Az Én területé `boop-en` (a `me` a route, az `en` a szín neve) —
 *  ez az EGY eltérés, és pont ez ejtette ki némán az Én sorát az első körben. */
const SYMBOL: Record<BoopDomain, string> = {
  nap: 'boop-nap', train: 'boop-train', fuel: 'boop-fuel', mezo: 'boop-mezo', me: 'boop-en',
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

export function Boop({ domain, size = 44, alive = false, className }: {
  domain: BoopDomain
  size?: number
  /** Él-e a figura: tekintet + szemöldök + lélegzet. Alapban NEM — a menü-ikon nyugodt. */
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
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
