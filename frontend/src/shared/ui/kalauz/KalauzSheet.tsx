// ============================================================
// Mezo · KalauzSheet — a Mezo-kalauz lapozó sheetje (mezo-gb1s.1, spec §4).
// Domain-mentes: a kártyákat adatként kapja, a seen-állapotról semmit nem tud — azt a
// TutorialProvider intézi az `onClose(reason, step)` alapján. A meglévő `Sheet`-re épül
// (portál a .phone-screen-be, Escape, drag). Peek = a sheet sávvá húzódik, a hátlap
// átlátszó, egy `.kalauz-spot` doboz árnyéka sötétít a horgony-elem KÖRÜL (a horgony maga
// tiszta marad) — így a spotlight nem nyúl az oldal z-indexéhez. Bármilyen koppintás
// (hátlap, horgony, sáv) visszahozza a sheetet; a kalauz peek alatt sosem záródik.
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClayIcon, ClaySpot, type ClayIconName, type ClaySpotName } from '@/shared/ui/clay'
import { Sheet } from '@/shared/ui/Sheet'

type Art = ClayIconName | ClaySpotName
type Orb = 's-orb' | 's-orb-figyel' | 's-orb-unnepel' | 's-orb-ejszaka'
interface CardBase { title: string; voice: string; orb?: Orb }
export type KalauzSheetCard =
  | (CardBase & { kind: 'intro'; spot: Art })
  | (CardBase & { kind: 'fogalom'; spot: Art; term: string; def: string })
  | (CardBase & { kind: 'hogyan'; spot: Art; anchor?: string })
  | (CardBase & { kind: 'mikor'; spot: Art })
  | (CardBase & { kind: 'kapcsolat'; links: { to: string; label: string; icon: ClayIconName; effect?: string }[] })

export type KalauzCloseReason = 'skip' | 'done'

export interface KalauzSheetProps {
  label: string
  cards: KalauzSheetCard[]
  onClose: (reason: KalauzCloseReason, step: number) => void
  onNavigate: (to: string) => void
}

const QUESTION: Record<KalauzSheetCard['kind'], string> = {
  intro: 'Mi ez?', fogalom: 'Mire jó?', hogyan: 'Hogyan használjuk?', mikor: 'Mikor nézzük?', kapcsolat: 'Mivel függ össze?',
}

const isSpotName = (n: Art): n is ClaySpotName => n.startsWith('s-')

function Art({ name, size }: { name: Art; size: number }) {
  return isSpotName(name) ? <ClaySpot name={name} size={size} className="kalauz-spotart" />
    : <ClayIcon name={name} size={size} className="kalauz-spotart" />
}

interface SpotRect { top: number; left: number; width: number; height: number }

function measureAnchor(anchor: string): SpotRect | null {
  const el = document.querySelector<HTMLElement>(`[data-kalauz-anchor="${anchor}"]`)
  if (!el) return null
  const host = document.querySelector('.phone-screen') ?? document.body
  const r = el.getBoundingClientRect()
  const h = host.getBoundingClientRect()
  return { top: r.top - h.top, left: r.left - h.left, width: r.width, height: r.height }
}

export function KalauzSheet({ label, cards, onClose, onNavigate }: KalauzSheetProps) {
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  const [peek, setPeek] = useState<SpotRect | null>(null)
  const card = cards[step]
  const last = step === cards.length - 1
  const anchorPresent = card.kind === 'hogyan' && !!card.anchor && measureAnchor(card.anchor) !== null

  const go = useCallback((k: number) => {
    setStep(k)
    setSeen((s) => new Set(s).add(k))
  }, [])
  const unpeek = useCallback(() => setPeek(null), [])

  // Peek alatt a horgony méretét újramérjük görgetésre/átméretezésre — a sáv nem takarhatja.
  useLayoutEffect(() => {
    if (!peek || card.kind !== 'hogyan' || !card.anchor) return
    const anchor = card.anchor
    const re = () => setPeek(measureAnchor(anchor))
    window.addEventListener('resize', re)
    return () => window.removeEventListener('resize', re)
  }, [peek, card])
  useEffect(() => { setPeek(null) }, [step])

  return (
    <Sheet
      onClose={() => onClose('skip', step)}
      className={cn('kalauz-sheet', peek && 'is-peek')}
      labelledBy="kalauz-title"
      onBackdropClick={peek ? unpeek : undefined}
      backdropClassName={peek ? 'kalauz-clear' : undefined}
    >
      {(close) => (
        <>
          <span id="kalauz-title" className="sr-only">Kalauz · {label}</span>
          {peek && card.kind === 'hogyan' && (
            <>
              <div className="kalauz-spot" style={{ top: peek.top, left: peek.left, width: peek.width, height: peek.height }} aria-hidden="true" />
              <div className="kalauz-peekbar" onClick={unpeek}>
                <ClaySpot name="s-orb-figyel" size={34} />
                <span className="kalauz-peektxt"><SafeMarkdown text={card.voice} /> <span className="kalauz-peekhint">Koppints bárhova.</span></span>
                <button type="button" className="kalauz-ghost" onClick={unpeek}>Vissza</button>
              </div>
            </>
          )}
          <div className={cn('kalauz-body', peek && 'is-hidden')} aria-hidden={peek ? true : undefined}>
            <div className="kalauz-top">
              <span className="mz-eyebrow">Kalauz · <b>{label}</b></span>
              <span className="mz-eyebrow kalauz-step">{step + 1} / {cards.length}</span>
              <button type="button" className="kalauz-x" aria-label="Bezárás" onClick={close}>✕</button>
            </div>

            <div className="kalauz-card" key={step}>
              <div className="kalauz-q"><span className="kalauz-n">{step + 1}</span>{QUESTION[card.kind]}</div>
              <div className="kalauz-title">{card.title}</div>
              <div className="kalauz-art">
                <ClaySpot name={card.orb ?? 's-orb'} size={card.kind === 'intro' ? 92 : 70} className="kalauz-orb" />
                {card.kind !== 'kapcsolat' && <Art name={card.spot} size={card.kind === 'intro' ? 76 : 80} />}
              </div>
              <div className="kalauz-voice"><SafeMarkdown text={card.voice} /></div>
              {card.kind === 'fogalom' && (
                <div className="kalauz-fogalom">
                  <div className="kalauz-term">{card.term}</div>
                  <div className="kalauz-def"><SafeMarkdown text={card.def} /></div>
                </div>
              )}
              {card.kind === 'hogyan' && anchorPresent && (
                <button type="button" className="kalauz-show" onClick={() => setPeek(measureAnchor(card.anchor!))}>
                  <span aria-hidden="true">◎</span> Mutasd meg a képernyőn
                </button>
              )}
              {card.kind === 'kapcsolat' && (
                <div className="kalauz-chips">
                  {card.links.map((l) => (
                    <button key={l.to} type="button" className="kalauz-chip"
                      onClick={() => { onNavigate(l.to); onClose('done', step) }}>
                      <ClayIcon name={l.icon} size={19} />{l.label}
                      {l.effect && <span className="kalauz-chip-to"> · {l.effect}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="kalauz-dots" aria-label="Kártyák">
              {cards.map((_, k) => (
                <button key={k} type="button" aria-label={`${k + 1}. kártya`}
                  className={cn('kalauz-dot', k === step && 'on', k !== step && seen.has(k) && 'seen')} onClick={() => go(k)} />
              ))}
            </div>
            <div className="kalauz-foot">
              {!last && <button type="button" className="kalauz-ghost kalauz-link" onClick={close}>Kihagyom</button>}
              <button type="button" className="kalauz-ghost kalauz-back" aria-label="Előző kártya" disabled={step === 0} onClick={() => go(step - 1)}>‹ Vissza</button>
              {last
                ? <button type="button" className="kalauz-cta" onClick={() => onClose('done', step)}>Értem, kezdjük</button>
                : <button type="button" className="kalauz-cta" onClick={() => go(step + 1)}>Tovább</button>}
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}
