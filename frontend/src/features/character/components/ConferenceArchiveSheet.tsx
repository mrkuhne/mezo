// ============================================================
// Mezo · Karakter — ConferenceArchiveSheet (mezo-sp9w)
// A régi konzílium-LISTAOLDAL utódja. Alulról felcsúszó lap, nem route — így a Konzíliumon
// pontosan egy visszalépő vezérlő marad (`PageHead`), és a lista-oldal dupla vissza-gombja
// nem jön vissza a hátsó ajtón.
//
// Fix magasság, akárhány év: a hónap-fejlécek a lap BELSEJÉBEN görögnek.
//
// Őszinteség: a sor kimenete csak a nem-nulla tételeket sorolja. Egy konzílium, ami semmit nem
// változtatott a dossziéban, kimenet nélküli sorként jelenik meg — üresen, nem "0 bekerült"-tel.
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

/** Only the non-zero counts, in dossier-effect order. Empty string when nothing changed —
 *  the row then carries no outcome text at all, which is the truth, not a missing value. */
export function outcomeLabel(outcome: CharacterConferenceSummary['outcome']): string {
  const parts: string[] = []
  if (outcome.accepted > 0) parts.push(`${outcome.accepted} bekerült`)
  if (outcome.retired > 0) parts.push(`${outcome.retired} nyugdíjazva`)
  if (outcome.portraitRewritten > 0) parts.push(`${outcome.portraitRewritten} portré átírva`)
  return parts.join(' · ')
}

export function ConferenceArchiveSheet({ conferences, currentId, onPick, onClose }: {
  conferences: CharacterConferenceSummary[]
  currentId: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} className="kr-arcsheet" labelledBy="kr-arctitle">
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
                    {outcome !== '' && <span className="kr-arcout">{outcome}</span>}
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
