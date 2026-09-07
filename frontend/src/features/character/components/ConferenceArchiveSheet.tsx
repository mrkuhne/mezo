// ============================================================
// Mezo · Karakter — ConferenceArchiveSheet (mezo-sp9w)
// A régi konzílium-LISTAOLDAL utódja. Alulról felcsúszó lap, nem route — így a Konzíliumon
// pontosan egy visszalépő vezérlő marad (`PageHead`), és a lista-oldal dupla vissza-gombja
// nem jön vissza a hátsó ajtón.
//
// Fix magasság, akárhány év: a hónap-fejlécek a lap BELSEJÉBEN görögnek.
//
// Őszinteség: a sor kimenete csak a nem-nulla tételeket sorolja, a három megnevezett hatás
// (bekerült/nyugdíjazva/portré átírva) után egy negyedik, gyűjtő tétellel ("N egyéb változás")
// a dosszié minden más valós hatására (megbízhatóság erősödött/gyengült, fejezet nyílt/lezárt —
// lásd ClaimLifecycle.java) — így egy konzílium, aminek KIZÁRÓLAG ilyen hatása volt, sosem
// jelenik meg kimenet nélküli sorként. Egy konzílium, ami semmit nem változtatott a dossziéban,
// kimenet nélküli sorként jelenik meg — üresen, nem "0 bekerült"-tel.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import type { CharacterConferenceSummary } from '@/data/character/characterApi'

const KIND_BADGE: Record<CharacterConferenceSummary['kind'], string> = {
  WEEKLY: 'HETI',
  MONTHLY: 'HAVI',
  BOOTSTRAP: 'BOOTSTRAP',
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}`
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()} · ${d.toLocaleDateString('hu-HU', { month: 'long' })}`
}

function yearOf(iso: string): number {
  return new Date(iso).getFullYear()
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })
}

/** The three named-effect fragments only, in dossier-effect order. */
function namedOutcomeLabel(outcome: CharacterConferenceSummary['outcome']): string {
  const parts: string[] = []
  if (outcome.accepted > 0) parts.push(`${outcome.accepted} bekerült`)
  if (outcome.retired > 0) parts.push(`${outcome.retired} nyugdíjazva`)
  if (outcome.portraitRewritten > 0) parts.push(`${outcome.portraitRewritten} portré átírva`)
  return parts.join(' · ')
}

/** The catch-all "other" fragment (confidence strengthened/weakened, a chapter opened/retired,
 *  ... — see `ClaimLifecycle.java`), or '' when there is none. */
function otherOutcomeLabel(outcome: CharacterConferenceSummary['outcome']): string {
  return outcome.other > 0 ? `${outcome.other} egyéb változás` : ''
}

/** Only the non-zero counts, in dossier-effect order, plus a trailing catch-all fragment for
 *  `other` so a council whose only effect was one of those (no accepted/retired/portrait change)
 *  still renders outcome text. Empty string when nothing changed at all — the row then carries
 *  no outcome text at all, which is the truth, not a missing value. */
export function outcomeLabel(outcome: CharacterConferenceSummary['outcome']): string {
  return [namedOutcomeLabel(outcome), otherOutcomeLabel(outcome)].filter((p) => p !== '').join(' · ')
}

export function ConferenceArchiveSheet({ conferences, currentId, onPick, onClose }: {
  conferences: CharacterConferenceSummary[]
  currentId: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  // M3 (mezo-sp9w branch-review): `kr-arcsheet` had no rule anywhere in the stylesheet — the
  // sheet is already fully styled by the shared `.sheet` base (prototype.css) plus the specific
  // `kr-arc*` classes on its own content (including the fixed-height scroll container,
  // `.kr-arcscroll { max-height: 62vh }`, which is what gives it its fixed height regardless of
  // how many years of history it lists). There is no sheet-level override this screen needs, so
  // the dead class is dropped rather than given an empty rule to justify keeping it.
  return (
    <Sheet onClose={onClose} labelledBy="kr-arctitle">
      {(close) => (
        <>
          <div className="kr-archd" id="kr-arctitle">
            Korábbi tanácskozások
            <span className="kr-arccnt">{conferences.length}</span>
          </div>
          <div className="kr-arcscroll">
            {conferences.map((conf, i) => {
              const prev = i > 0 ? conferences[i - 1] : null
              const newMonth = prev == null || monthKey(prev.generatedAt) !== monthKey(conf.generatedAt)
              const newYear = prev != null && yearOf(prev.generatedAt) !== yearOf(conf.generatedAt)
              const outcome = outcomeLabel(conf.outcome)
              const named = namedOutcomeLabel(conf.outcome)
              const other = otherOutcomeLabel(conf.outcome)
              return (
                <div key={conf.id}>
                  {newYear && <div className="kr-arcyr">{yearOf(conf.generatedAt)}</div>}
                  {newMonth && <div className="kr-arcmh">{monthLabel(conf.generatedAt)}</div>}
                  <button
                    type="button"
                    className={`kr-arcrow${conf.id === currentId ? ' on' : ''}`}
                    onClick={() => { close(); onPick(conf.id) }}
                  >
                    <span className="kr-arcday">{dayLabel(conf.generatedAt)}</span>
                    {outcome !== '' && (
                      <span className="kr-arcout">
                        {named}
                        {named !== '' && other !== '' && ' · '}
                        {other !== '' && <span className="kr-arcout-other">{other}</span>}
                      </span>
                    )}
                    <span className={`kr-kbadge ${conf.kind.toLowerCase()}`}>{KIND_BADGE[conf.kind]}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}
