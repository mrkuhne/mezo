// ============================================================
// Mezo · ObservationCard — az Észrevételek fül kártyája (Reflexió S5, mezo-eq85.5)
// Vizuális igazság: docs/design_2.0/prototypes/eszrevetelek.html #obsScreen (`.obs`).
// Poszter-anatómia: eyebrow + clay-korong + EGY dőlt mondat + chipek; a `watching`
// kártyán a próza helyett a SZÁMOK beszélnek (tally + haladás-sáv + Laborfüzet-link).
// A chipek a slice 4 `POST /api/companion/pattern/{id}/reply` végpontjára felelnek.
// ============================================================
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { cn } from '@/shared/lib/cn'
import { timeLabel } from '@/features/notification/logic/stamp'
import type { Observation, ObservationCardKind, ObservationChoice } from '@/data/types'

/** A prototípus négy kártya-modifikátora — a wire kártyanevek NEM egyeznek vele 1:1. */
const CARD_CLASS: Record<ObservationCardKind, string> = {
  fresh: 'nap-obs-fresh',
  return: 'nap-obs-return',
  watching: 'nap-obs-watch',
  confirmed: 'nap-obs-done',
}

const STATE_PILL: Record<ObservationCardKind, string> = {
  fresh: 'ÚJ',
  return: 'FIGYELEM',
  watching: 'GYŰLIK',
  confirmed: 'BEÉPÜLT',
}

/** A nyugtázó sor a prototípus `data-ack` szövegeiből, emoji nélkül (házszabály). */
function ackLine(card: ObservationCardKind, choice: ObservationChoice): string {
  if (choice === 'talk') return 'Megnyitom a chatet ezzel a szállal.'
  if (card === 'return') {
    return choice === 'watch'
      ? 'Beírtam a bizonyítékok közé.'
      : 'Rendben, kivételként jegyzem, nem számít bele.'
  }
  return choice === 'watch'
    ? 'Rendben, figyelem. Nyolc napnál újra szólok.'
    : 'Értem, nem stimmel. Nem hozom fel újra ebben a formában.'
}

/** A `fresh` kártya három, a `return` kettő chipet ad; a sor-kártyákon nincs mit megválaszolni. */
function chipsFor(card: ObservationCardKind): { label: string; choice: ObservationChoice; tone?: 'yes' | 'talk' }[] {
  if (card === 'fresh') {
    return [
      { label: 'Igen, figyeld', choice: 'watch', tone: 'yes' },
      { label: 'Nem stimmel', choice: 'reject' },
      { label: 'Mesélj', choice: 'talk', tone: 'talk' },
    ]
  }
  if (card === 'return') {
    return [
      { label: 'Így van', choice: 'watch', tone: 'yes' },
      { label: 'Kivétel volt', choice: 'reject' },
    ]
  }
  return []
}

function eyebrow(item: Observation): string {
  // A dróton UTC-ben jön (`…T12:12:00Z`) — a nyers karakterlánc-szeletelés az UTC órát írná ki,
  // ezért a közös, helyi idejű `timeLabel` formázza (ugyanaz, amit a fejléc és az értesítés-feed használ).
  const time = timeLabel(item.occurredAt)
  if (item.card === 'fresh') return `${time} · Feltűnt`
  if (item.card === 'return') return 'Visszatérés · egy korábbi válaszod után'
  if (item.card === 'watching') return `Figyelem · ${item.evidenceHits + item.evidenceMisses}. napja`
  return 'Megerősítve'
}

export function ObservationCard({ item, onReply, pending = false }: {
  item: Observation
  /** A chip-válasz. A `talk` ág visszaadhat egy beszélgetés-azonosítót — arra navigálunk. */
  onReply: (patternId: string, choice: ObservationChoice) => void | Promise<{ conversationId?: string } | void>
  /** Igaz, amíg ENNEK a sornak a válasza úton van — a szerver oldali válasz nem idempotens,
   *  ezért a chip-csoport ilyenkor tiltott (kettős koppintás = két válasz). */
  pending?: boolean
}) {
  const navigate = useNavigate()
  // A szerver által ismert válasz és a most adott válasz ugyanaz a nyugtázott állapot: a
  // kártya azonnal átvált, nem várja meg a feed újratöltését.
  const [justAnswered, setJustAnswered] = useState<ObservationChoice | null>(null)
  const [failed, setFailed] = useState(false)
  // Csak az ESEMÉNY-kártyák (fresh/return) kérdeznek — a sor-kártyák `repliedChoice`-a a sor
  // korábbi válasza, nem ennek a kártyának a nyugtázandó felelete.
  const asks = chipsFor(item.card).length > 0
  const answered = asks ? (justAnswered ?? item.repliedChoice ?? null) : null
  const chips = answered ? [] : chipsFor(item.card)

  // Optimista nyugtázás, VISSZAGÖRGETÉSSEL: a kártya azonnal átvált, de ha a hívás elbukik,
  // a chipek visszajönnek egy hibasorral. Nyugtázva hagyni egy el nem küldött választ hazugság
  // lenne — a felhasználó azt hinné, Mezo megjegyezte.
  const answer = async (choice: ObservationChoice) => {
    setJustAnswered(choice)
    setFailed(false)
    try {
      const res = await onReply(item.patternId, choice)
      if (choice === 'talk' && res && res.conversationId) {
        navigate(`/mezo/chat?c=${res.conversationId}`)
      }
    } catch {
      setJustAnswered(null)
      setFailed(true)
    }
  }

  const seen = item.evidenceHits + item.evidenceMisses
  const need = item.minN ?? 8
  const slots = Array.from({ length: Math.max(need, seen) }, (_, i) =>
    i < item.evidenceHits ? 'hit' : i < seen ? 'miss' : 'none',
  )

  return (
    <article className={cn('nap-obs', CARD_CLASS[item.card], answered && 'answered')}>
      <div className="nap-obs-top">
        <span className="nap-obs-disc"><ClayIcon name={item.sourceIcon} size={24} /></span>
        <div>
          <div className="eb">{eyebrow(item)}</div>
          <div className="ttl">{item.title}</div>
        </div>
        <span className="nap-obs-pill">{STATE_PILL[item.card]}</span>
      </div>

      {/* A `watching` kártyán a wire `text` ÜRES — ott nincs mondat, a kérdés-sor viszi a számokat. */}
      {item.text !== '' && <p className="nap-obs-say"><SafeMarkdown text={item.text} /></p>}
      {item.question && <p className="nap-obs-ask"><SafeMarkdown text={item.question} /></p>}

      {item.evidence.length > 0 && (
        <div className="nap-obs-evid">
          {item.evidence.map((e, i) => <span key={i}>{e}</span>)}
        </div>
      )}

      {item.card === 'watching' && (
        <>
          <div className="nap-obs-tally" aria-label="Napok: bejött, nem jött be, még nincs adat">
            {slots.map((s, i) => (
              <i key={i} className={s}>{s === 'hit' ? '✓' : s === 'miss' ? '✕' : '·'}</i>
            ))}
          </div>
          <div className="nap-obs-progcopy"><span>Bizonyíték</span><strong>{seen} / {need} nap</strong></div>
          <div className="nap-obs-prog" aria-label={`${seen} a szükséges ${need} napból`}>
            <i style={{ '--w': `${Math.min(100, (seen / need) * 100)}%` } as React.CSSProperties} />
          </div>
          {item.hypothesisKey && (
            <Link className="nap-obs-more" to={`/mezo/patterns/${item.hypothesisKey}`}>Laborfüzet ›</Link>
          )}
        </>
      )}

      {chips.length > 0 && (
        <div className="nap-obs-chips" role="group" aria-label="Válaszod az észrevételre">
          {chips.map((c) => (
            <button key={c.choice} type="button" className={cn('chip', c.tone)}
              disabled={pending} onClick={() => { void answer(c.choice) }}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {failed && !answered && (
        <div className="nap-obs-err" role="alert">Nem sikerült elküldeni — próbáld újra.</div>
      )}
      {answered && <div className="nap-obs-ack">{ackLine(item.card, answered)}</div>}
    </article>
  )
}
