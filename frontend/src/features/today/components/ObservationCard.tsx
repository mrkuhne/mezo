// ============================================================
// Mezo · ObservationCard — az Észrevételek fül kártyája (Reflexió S5, mezo-eq85.5)
// Vizuális igazság: docs/design_2.0/prototypes/eszrevetelek.html #obsScreen (`.obs`).
// Poszter-anatómia: eyebrow + clay-korong + EGY dőlt mondat + chipek; a `watching`
// kártyán a próza helyett a SZÁMOK beszélnek (tally + haladás-sáv + Laborfüzet-link).
// A chipek a slice 4 `POST /api/companion/pattern/{id}/reply` végpontjára felelnek.
// Üveg (mezo-me75u.3, prototypes/uveg-nap.html#uzenetek/eszrevetelek): a kártya egy `.glass`
// (fresh/return lavender, watching sky, confirmed sage), a forrás 3D-ikonja egy lit wellben,
// a válasz-pillek laposak (az igen lit), a tally jelei 3D pipa/kihagyás + lapos pötty.
// Újragondolva (mezo-me75u.12, prototypes/uveg-eszrevetel.html): Mezo mondata EGYENES Geist
// (bible U3/23 — bekezdés-prózán nincs dőlt serif), a bizonyíték tagolt sorok (forrás-ikon +
// nap, címkézett értékek, a saját jegyzet idézetként; két+ check-in egy közös „Változás”
// grafikon), a kérdés pedig közvetlenül a válasz-pillek fölött ül. A bizonyíték nyitva indul,
// megválaszolt kártyán csukva — egy koppintással nyílik.
// ============================================================
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ContentIcon, Icon3D, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { cn } from '@/shared/lib/cn'
import { dayLabel, timeLabel } from '@/features/notification/logic/stamp'
import { Boop } from '@/shared/ui/clay/boop/Boop'
import { localDateString } from '@/shared/lib/dates'
import { EvidenceList } from '@/shared/ui/evidence/EvidenceList'
import type { Observation, ObservationCardKind, ObservationChoice } from '@/data/types'

/** A prototípus négy kártya-modifikátora — a wire kártyanevek NEM egyeznek vele 1:1. */
const CARD_CLASS: Record<ObservationCardKind, string> = {
  fresh: 'nap-obs-fresh',
  return: 'nap-obs-return',
  watching: 'nap-obs-watch',
  confirmed: 'nap-obs-done',
}

/** A kártya egyetlen üveg-akcentusa (`--c`, bible §2). */
const CARD_HUE: Record<ObservationCardKind, string> = {
  fresh: 'var(--dv-lav)',
  return: 'var(--dv-lav)',
  watching: 'var(--dv-sky)',
  confirmed: 'var(--dv-sage)',
}

/** A forrás-ikon 3D-arca. Az `i-mezo` (Mezo saját ötlete) kétértelmű a `CLAY_TO_3D`-ben, ezért
 *  itt, a hívásnál kap nevet: a prototípus észrevétel-art-ja (`t-score`). A többi a közös
 *  térképen megy (i-naplo → t-journal, i-alvas → t-sleep, i-edzes → t-dumbbell, …). */
function sourceArt(icon: ClayIconName): ClayIconName | Icon3DName {
  return icon === 'i-mezo' ? 't-score' : icon
}

/** A tally-slot elérhető szövege — a korábbi ✓/✕/· glifák jelentése, most hangban. */
const SLOT_TEXT = { hit: 'bejött', miss: 'nem jött be', none: 'még nincs adat' } as const

const STATE_PILL: Record<ObservationCardKind, string> = {
  fresh: 'ÚJ',
  return: 'FIGYELEM',
  watching: 'GYŰLIK',
  confirmed: 'BEÉPÜLT',
}

/** A felhasználó tapasztalata külön marad a mért bizonyítéktól. */
function ackLine(choice: ObservationChoice): string {
  if (choice === 'talk') return 'Megnyitom a chatet ezzel a szállal.'
  if (choice === 'reject') return 'Értem, ez nem stimmel. Nem hozom fel újra ebben a formában.'
  return 'Megjegyeztem, hogy ez igaz rád. Az összefüggést tovább figyelem.'
}

function chipsFor(card: ObservationCardKind): { label: string; choice: ObservationChoice; tone?: 'yes' | 'talk' }[] {
  if (card !== 'fresh' && card !== 'return') return []
  return [
    { label: 'Igen, ez igaz rám', choice: 'watch', tone: 'yes' },
    { label: 'Nem, ez nem stimmel', choice: 'reject' },
    { label: 'Beszéljük meg', choice: 'talk', tone: 'talk' },
  ]
}

function eyebrow(item: Observation): string {
  // A dróton UTC-ben jön (`…T12:12:00Z`) — a nyers karakterlánc-szeletelés az UTC órát írná ki,
  // ezért a közös, helyi idejű `timeLabel` formázza (ugyanaz, amit a fejléc és az értesítés-feed használ).
  const time = `${dayLabel(item.occurredAt)} ${timeLabel(item.occurredAt)}`
  if (item.card === 'fresh') return `Feltűnt · ${time}`
  if (item.card === 'return') return `Visszatérés · ${time}`
  if (item.card === 'watching') return item.kind === 'statistical' || item.minN == null
    ? 'Figyelt összefüggés' : `Figyelem · ${item.evidenceHits + item.evidenceMisses} megfigyelt nap`
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
  // A bizonyíték nyitva indul (ettől hihető az észrevétel); a már megválaszolt kártyán csukva.
  const [evOpen, setEvOpen] = useState<boolean | null>(null)
  const evidenceOpen = evOpen ?? !answered
  const today = localDateString()
  const records = item.evidence.filter((e) => e.kind === 'record').length

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
  const slots: (keyof typeof SLOT_TEXT)[] = Array.from({ length: Math.max(need, seen) }, (_, i) =>
    i < item.evidenceHits ? 'hit' : i < seen ? 'miss' : 'none',
  )

  return (
    <article className={cn('nap-obs', 'glass', CARD_CLASS[item.card], answered && 'answered')}
      style={{ '--c': CARD_HUE[item.card] } as React.CSSProperties}>
      <div className="nap-obs-top">
        <span className="nap-obs-disc uv-well"><ContentIcon name={sourceArt(item.sourceIcon)} size={30} /></span>
        <div>
          <div className="eb">{eyebrow(item)}</div>
          <div className="ttl">{item.title}</div>
        </div>
        <span className="nap-obs-pill">{STATE_PILL[item.card]}</span>
      </div>

      {/* A `watching` kártyán a wire `text` ÜRES — ott nincs mondat, a számok beszélnek. */}
      {item.text !== '' && <p className="nap-obs-say"><SafeMarkdown text={item.text} /></p>}
      {/* A nem-kérdező kártyák (figyelt / megerősített) kérdés-sora a mondat alatt marad. */}
      {item.question && !asks && <p className="nap-obs-ask"><SafeMarkdown text={item.question} /></p>}

      {item.evidence.length > 0 && (
        <>
          <div className="nap-obs-evh">
            <span>Miből látom{records > 0 ? ` · ${records} bejegyzés` : ''}</span>
            <button type="button" aria-expanded={evidenceOpen} onClick={() => setEvOpen(!evidenceOpen)}>
              {evidenceOpen ? 'Elrejtem' : 'Megnézem ›'}
            </button>
          </div>
          {evidenceOpen && <EvidenceList evidence={item.evidence} today={today} />}
        </>
      )}

      {item.card === 'watching' && item.kind !== 'statistical' && item.minN != null && (
        <>
          <div className="nap-obs-tally" aria-label="Napok: bejött, nem jött be, még nincs adat">
            {slots.map((s, i) => (
              <i key={i} className={s} data-slot={s}>
                {s === 'hit' ? <Icon3D name="t-tick" size={17} /> : s === 'miss' ? <Icon3D name="t-skip" size={17} /> : null}
                <span className="sr-only">{SLOT_TEXT[s]}</span>
              </i>
            ))}
          </div>
          <div className="nap-obs-progcopy"><span>Bizonyíték</span><strong>{seen} / {need} nap</strong></div>
          <div className="nap-obs-prog" aria-label={`${seen} a szükséges ${need} napból`}>
            <i style={{ '--w': `${Math.min(100, (seen / need) * 100)}%` } as React.CSSProperties} />
          </div>

        </>
      )}

      {item.card === 'watching' && item.hypothesisKey && (
        <Link className="nap-obs-more" to={`/mezo/patterns/${item.hypothesisKey}`}>Laborfüzet ›</Link>
      )}

      {chips.length > 0 && (
        <div className="nap-obs-q">
          <span className="nap-obs-qeb"><Boop domain="mezo" size={18} />Mezo kérdezi</span>
          {item.question && <p className="nap-obs-ask"><SafeMarkdown text={item.question} /></p>}
          <div className="nap-obs-chips" role="group" aria-label="Válaszod az észrevételre">
            {chips.map((c) => (
              <button key={c.choice} type="button" className={cn('chip', c.tone)}
                disabled={pending} onClick={() => { void answer(c.choice) }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {failed && !answered && (
        <div className="nap-obs-err" role="alert">Nem sikerült elküldeni — próbáld újra.</div>
      )}
      {answered && (
        <div className="nap-obs-ack"><Icon3D name="t-tick" size={24} /><span>{ackLine(answered)}</span></div>
      )}
    </article>
  )
}
