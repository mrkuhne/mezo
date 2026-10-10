// ============================================================
// Mezo · ObservationCard — az Észrevételek fül kártyája (Reflexió S5, mezo-eq85.5; Folyadék
// mezo-n4wf5.2, prototípus vilagos/nap.js `obsCard` + `tally`).
// Egy fehér kártya: fej (a forrás jele + cím), állapot-pill, a `watching` kártyán a
// bizonyíték-edények (ami egybevág, tele; ami ellene szól, szaggatott; ami még hiányzik, üres),
// Mezo mondata, a „Miből látom” bizonyíték (tagolt sorok, `EvidenceList`), a kérdés a
// válasz-gombok fölött, végül a Laborfüzet-link. A bizonyíték nyitva indul, megválaszolt
// kártyán csukva — egy koppintással nyílik.
// A gombok a slice 4 `POST /api/companion/pattern/{id}/reply` végpontjára felelnek.
// ============================================================
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CLAY_TO_3D, Icon3D, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { dayLabel, timeLabel } from '@/features/notification/logic/stamp'
import { localDateString } from '@/shared/lib/dates'
import { EvidenceList } from '@/shared/ui/evidence/EvidenceList'
import { Acts, Badge, Btn, Card, Head, Lk, Msg, St, Txt } from '@/shared/ui/folyadek'
import type { Observation, ObservationCardKind, ObservationChoice } from '@/data/types'

/** A forrás jele. Az `i-mezo` (Mezo saját ötlete) kétértelmű a `CLAY_TO_3D`-ben, ezért itt kap
 *  nevet: az észrevétel jele (`t-score`). A többi a közös térképen megy (i-naplo → t-journal,
 *  i-alvas → t-sleep, i-edzes → t-dumbbell, …); ami ott sincs, a minta jelét kapja. */
function sourceArt(icon: ClayIconName): Icon3DName {
  return icon === 'i-mezo' ? 't-score' : CLAY_TO_3D[icon] ?? 't-pattern'
}

/** A bizonyíték-edény elérhető szövege. */
const SLOT_TEXT = { hit: 'bejött', miss: 'nem jött be', none: 'még nincs adat' } as const

const STATE_PILL: Record<ObservationCardKind, { label: string; tone: 'plan' | 'warn' | 'ok' }> = {
  fresh: { label: 'ÚJ', tone: 'plan' },
  return: { label: 'FIGYELEM', tone: 'warn' },
  watching: { label: 'GYŰLIK', tone: 'plan' },
  confirmed: { label: 'BEÉPÜLT', tone: 'ok' },
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

/** A kártya fajta-címkéje az idővel — a hívó oldal szakaszcíme is ez. */
export function observationEyebrow(item: Observation): string {
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
  /** A válasz. A `talk` ág visszaadhat egy beszélgetés-azonosítót — arra navigálunk. */
  onReply: (patternId: string, choice: ObservationChoice) => void | Promise<{ conversationId?: string } | void>
  /** Igaz, amíg ENNEK a sornak a válasza úton van — a szerver oldali válasz nem idempotens,
   *  ezért a gomb-csoport ilyenkor tiltott (kettős koppintás = két válasz). */
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
  // a gombok visszajönnek egy hibasorral. Nyugtázva hagyni egy el nem küldött választ hazugság
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
  const pill = STATE_PILL[item.card]
  const label = observationEyebrow(item)

  return (
    <Card className={answered ? 'nb-obs answered' : 'nb-obs'} data-card={item.card}>
      <Head icon={sourceArt(item.sourceIcon)} title={item.title} />
      <div className="nb-obst">
        <St tone={pill.tone}>{pill.label}</St>
        {/* A `watching` kártyán nincs mondat, ezért a fajta-címke itt áll, nem Mezo neve mellett. */}
        {item.text === '' && <span className="nb-obeb">{label}</span>}
      </div>

      {item.card === 'watching' && item.kind !== 'statistical' && item.minN != null && (
        <>
          <div className="nb-tally" aria-label="Napok: bejött, nem jött be, még nincs adat">
            {slots.map((s, i) => (
              <i key={i} className={s} data-slot={s}><span className="sr-only">{SLOT_TEXT[s]}</span></i>
            ))}
          </div>
          <div className="nb-leg">
            <b>{`Bizonyíték · ${seen} / ${need} nap`}</b>
            <span><i className="hit" />egybevág</span>
            <span><i className="miss" />ellene szól</span>
            <span><i className="none" />még hiányzik</span>
          </div>
        </>
      )}

      {/* A `watching` kártyán a wire `text` ÜRES — ott nincs mondat, a számok beszélnek. */}
      {item.text !== '' && (
        <Msg member="mezo" meta={label.toLowerCase()}><p className="nb-say"><SafeMarkdown text={item.text} /></p></Msg>
      )}
      {/* A nem-kérdező kártyák (figyelt / megerősített) kérdés-sora a mondat alatt marad. */}
      {item.question && !asks && <Txt className="nb-ask"><SafeMarkdown text={item.question} /></Txt>}

      {item.evidence.length > 0 && (
        <>
          <div className="nb-evh">
            <span>Miből látom{records > 0 ? ` · ${records} bejegyzés` : ''}</span>
            <Lk aria-expanded={evidenceOpen} onClick={() => setEvOpen(!evidenceOpen)}>
              {evidenceOpen ? 'Elrejtem' : 'Megnézem ›'}
            </Lk>
          </div>
          {evidenceOpen && <EvidenceList evidence={item.evidence} today={today} />}
        </>
      )}

      {chips.length > 0 && (
        <div className="nb-q">
          <span className="nb-qeb"><Badge member="mezo" size={24} />Mezo kérdezi</span>
          {item.question && <Txt className="nb-ask"><SafeMarkdown text={item.question} /></Txt>}
          <Acts className="nb-chips" role="group" aria-label="Válaszod az észrevételre">
            {chips.map((c, i) => (
              <Btn key={c.choice} sm ghost={i > 0} disabled={pending} onClick={() => { void answer(c.choice) }}>
                {c.label}
              </Btn>
            ))}
          </Acts>
        </div>
      )}
      {failed && !answered && (
        <div className="nb-err" role="alert">Nem sikerült elküldeni — próbáld újra.</div>
      )}
      {answered && (
        <div className="nb-okline nb-ack"><Icon3D name="t-tick" size={18} /><span>{ackLine(answered)}</span></div>
      )}

      {item.card === 'watching' && item.hypothesisKey && (
        <Acts><Link className="fo-lk" to={`/mezo/patterns/${item.hypothesisKey}`}>Laborfüzet ›</Link></Acts>
      )}
    </Card>
  )
}
