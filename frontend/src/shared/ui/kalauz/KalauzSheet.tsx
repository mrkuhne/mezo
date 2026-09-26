// ============================================================
// Mezo · KalauzSheet — a Mezo-kalauz lapozó sheetje (mezo-gb1s.1, spec §4).
// Domain-mentes: a kártyákat adatként kapja, a seen-állapotról semmit nem tud — azt a
// TutorialProvider intézi az `onClose(reason, step)` alapján. A meglévő `Sheet`-re épül
// (portál a .phone-screen-be, Escape, drag). Peek = a sheet sávvá húzódik, a hátlap
// átlátszó, egy `.kalauz-spot` doboz árnyéka sötétít a horgony-elem KÖRÜL (a horgony maga
// tiszta marad) — így a spotlight nem nyúl az oldal z-indexéhez. Bármilyen koppintás
// (hátlap, horgony, sáv) visszahozza a sheetet; a kalauz peek alatt sosem záródik.
//
// Üveg (U10, mezo-me75u.10; prototípus uveg-reteg-body.html `openKz()` + `.kz*`): arany
// `<Sheet glass>`; a kártya képe NAGY 3D ikon keret nélküli arany halón (a régi agyag orb +
// agyag ikon helyett), a hang egyenes (bible 23. szabály), minden belső elem lapos (5. szabály).
// Peek alatt a lap látható csíkja maga az arany üveg sáv, a spot arany gyűrű.
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ContentIcon, Icon3D, type ClayIconName, type ClaySpotName, type Icon3DName } from '@/shared/ui/clay'
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

/** A kalauz képeinek 3D neve ott, ahol a `CLAY_TO_3D` nem tud (vagy nem akar) dönteni: a spotok
 *  (`s-*`) és a kontextusfüggő agyag jelek a kalauz-kártyák JELENTÉSE szerint (bible U1 7. szabály).
 *  Ami itt sincs és a `CLAY_TO_3D`-ben sincs, agyag ikonként marad (a ContentIcon visszaesése). */
const KALAUZ_3D: Partial<Record<Art, Icon3DName>> = {
  's-reggel': 't-dawn', 's-este': 't-moon', 's-energia': 't-bolt', 's-edzes': 't-dumbbell',
  's-medal': 't-record', 's-hegycel': 't-peak', 's-hajtas': 't-quest', 's-viz': 't-water',
  's-piheno': 't-sleep', 's-napzaras': 't-moon', 's-fuel': 't-bowl', 's-en': 't-person',
  'i-level': 't-chat', 'i-mezo': 't-chat', 'i-retegek': 't-layers', 'i-lombik': 't-flask',
  'i-sport': 't-volley', 'i-growth': 't-up',
}

/** A kártya képe (kapcsolat-kártyán a lánc), vagy egy chip ikonja — 3D, ha van rá név. */
function Art({ name, size, className }: { name: Art; size: number; className?: string }) {
  const t = KALAUZ_3D[name]
  if (t) return <Icon3D name={t} size={size} className={className} />
  // Egy le nem képzett spot (s-*) nem ContentIcon-név; a lánc-ikon a biztonságos visszaesés.
  if (name.startsWith('s-')) return <Icon3D name="t-link" size={size} className={className} />
  return <ContentIcon name={name as ClayIconName} size={size} className={className} />
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

  // A Sheet `onClose` a KILÉPŐ animáció végén fut, jóval a kattintás után — a reason/step ekkorra
  // már nem olvasható ki egy bezárás-pillanatbeli closure-ből. Ref-ben visszük tovább: a CTA és a
  // kapcsolat-chip 'done'-ra állítja kattintáskor, aztán a render-prop animált `close()`-t hívja
  // (nem közvetlenül `onClose`-t) — így a Kihagyom/✕/Escape/drag ugyanazt az animációt kapja.
  const reasonRef = useRef<KalauzCloseReason>('skip')
  const stepRef = useRef(step)
  stepRef.current = step

  const go = useCallback((k: number) => {
    setStep(k)
    setSeen((s) => new Set(s).add(k))
  }, [])
  const unpeek = useCallback(() => setPeek(null), [])

  // Peek alatt a horgony méretét görgetésre NEM kell újramérni (a hátlap koppintása alatt zárolt —
  // csak resize-ra figyelünk); átméretezésre viszont igen, mert a sáv nem takarhatja a horgonyt.
  useLayoutEffect(() => {
    if (!peek || card.kind !== 'hogyan' || !card.anchor) return
    const anchor = card.anchor
    const re = () => setPeek(measureAnchor(anchor))
    window.addEventListener('resize', re)
    return () => window.removeEventListener('resize', re)
  }, [peek, card])
  useEffect(() => { setPeek(null) }, [step])

  return (
    <>
      {peek && card.kind === 'hogyan' && createPortal(
        <div className="kalauz-spot" style={{ top: peek.top, left: peek.left, width: peek.width, height: peek.height }} aria-hidden="true" />,
        document.querySelector('.phone-screen') ?? document.body,
      )}
      <Sheet
        onClose={() => onClose(reasonRef.current, stepRef.current)}
        glass
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
              <div className="kalauz-peekbar" onClick={unpeek}>
                <span className="uv-well kalauz-peekwell" aria-hidden="true"><Icon3D name="t-eye" size={26} /></span>
                <span className="kalauz-peektxt"><span className="kalauz-peekvoice"><SafeMarkdown text={card.voice} /></span> <span className="kalauz-peekhint">Koppints bárhova.</span></span>
                <button type="button" className="kalauz-ghost kalauz-pill" onClick={unpeek}>Vissza</button>
              </div>
            </>
          )}
          <div className={cn('kalauz-body', peek && 'is-hidden')} aria-hidden={peek ? true : undefined}>
            <div className="kalauz-top">
              <span className="uv-eyebrow kalauz-eb">Kalauz · <b>{label}</b></span>
              <span className="kalauz-step">{step + 1} / {cards.length}</span>
              <button type="button" className="kalauz-x" aria-label="Bezárás" onClick={() => { reasonRef.current = 'skip'; close() }}>✕</button>
            </div>

            <div className="kalauz-card" key={step}>
              <div className="kalauz-q"><span className="kalauz-n">{step + 1}</span>{QUESTION[card.kind]}</div>
              <div className="kalauz-art" aria-hidden="true">
                {card.kind === 'kapcsolat'
                  ? <Icon3D name="t-link" size={88} className="kalauz-art-ico" />
                  : <Art name={card.spot} size={card.kind === 'intro' ? 92 : 88} className="kalauz-art-ico" />}
              </div>
              <div className="kalauz-title">{card.title}</div>
              <div className="kalauz-voice"><SafeMarkdown text={card.voice} /></div>
              {card.kind === 'fogalom' && (
                <div className="kalauz-fogalom">
                  <div className="kalauz-term">{card.term}</div>
                  <div className="kalauz-def"><SafeMarkdown text={card.def} /></div>
                </div>
              )}
              {card.kind === 'hogyan' && anchorPresent && (
                <button type="button" className="kalauz-show" onClick={() => setPeek(measureAnchor(card.anchor!))}>
                  <Icon3D name="t-eye" size={20} />Mutasd meg a képernyőn
                </button>
              )}
              {card.kind === 'kapcsolat' && (
                <div className="kalauz-chips">
                  {card.links.map((l) => (
                    <button key={l.to} type="button" className="kalauz-chip"
                      onClick={() => { onNavigate(l.to); reasonRef.current = 'done'; close() }}>
                      <Art name={l.icon} size={22} />{l.label}
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
              {!last && <button type="button" className="kalauz-link" onClick={() => { reasonRef.current = 'skip'; close() }}>Kihagyom</button>}
              <button type="button" className="kalauz-ghost kalauz-pill kalauz-back" aria-label="Előző kártya" disabled={step === 0} onClick={() => go(step - 1)}>‹ Vissza</button>
              {last
                ? <button type="button" className="kalauz-cta" onClick={() => { reasonRef.current = 'done'; close() }}>Értem, kezdjük</button>
                : <button type="button" className="kalauz-cta" onClick={() => go(step + 1)}>Tovább</button>}
            </div>
          </div>
        </>
      )}
      </Sheet>
    </>
  )
}
