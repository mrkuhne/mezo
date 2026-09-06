// ============================================================
// Mezo · HabitPage (mezo-3zue.4, split by mezo-bk26) — /me/rutin/szokas/:habitKey,
// prototype rutin-formalodas.html `pg-habit` ×1.18. ONE habit's DETAILS: the formation
// poster, the context rings, the lifetime history, and the recipe as a READ-ONLY sentence.
// Every write — fields, framework, anchor, mode, chain, xp, pause, delete — lives on the
// editor's own page (`/szerkesztes`, HabitEditPage): the in-place form was built first and
// failed in use, because this page grew long enough that the editor opened below the fold
// (choice board rutin-szerkeszto-valasztas.html, option B).
//
// The page NEVER ticks a habit (ADR — ticking lives on /nap/rutin).
// ============================================================
import { type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useHabitCatalog, useHabitFormation, useHabitSummary } from '@/data/hooks'
import type { HabitDaypart } from '@/data/types'
import { HabitContextRings } from '@/features/me/components/HabitContextRings'
import { HabitFormationCard } from '@/features/me/components/HabitFormationCard'
import { HabitFormationHistory } from '@/features/me/components/HabitFormationHistory'
import { recipeFromDef, routineSentenceParts } from '@/features/me/logic/routineSentence'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { ClayIconName } from '@/shared/ui/clay'

// The hero icon follows the OWNING CHAIN's daypart (RutinHubPage's DAYPART_ICON map) — a
// hardcoded dawn spot lied on every evening habit.
const DAYPART_ICON: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }

const FW_LABEL: Record<'FOGG' | 'CLEAR' | 'NONE', string> = {
  FOGG: '⚓ Szokás-láncolás',
  CLEAR: '◈ Négy törvény',
  NONE: '· Keret nélkül',
}

const PRINCIPLE = 'Ez az oldal a részleteké: a recept itt csak olvasható mondat. A szerkesztés '
  + 'saját oldalon él — így a formálódás-nézet nem verseng egy űrlappal.'

function rise(delayMs: number): CSSProperties {
  return { '--d': `${delayMs}ms` } as CSSProperties
}

export function HabitPage() {
  const navigate = useNavigate()
  const { habitKey = '' } = useParams<{ habitKey: string }>()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { data: summary } = useHabitSummary()
  const { data: formation } = useHabitFormation(habitKey)

  const defs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  const def = defs.find((d) => d.habitKey === habitKey)

  // A deep link lands here before the catalog has resolved: bouncing then would eject the
  // user from a perfectly valid habit. Only a RESOLVED catalog that has no such key redirects.
  if (def == null) {
    if (isPending) {
      return (
        <MozaikPage tone="gold">
          <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
          <PageBody><GhostState message="Szokás betöltése…" lines={3} /></PageBody>
        </MozaikPage>
      )
    }
    // A FAILED fetch is not a resolved miss: bouncing on it ejected the user from a habit that
    // exists, with no word about the failure. Only a catalog that actually answered redirects.
    if (isError) {
      return (
        <MozaikPage tone="gold">
          <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
          <PageBody>
            <GhostState message="Nem sikerült betölteni a szokást." ctaLabel="Újra" onCta={refetch} />
          </PageBody>
        </MozaikPage>
      )
    }
    return <Navigate to="/me/rutin" replace />
  }

  const fwKey: 'FOGG' | 'CLEAR' | 'NONE' = def.framework ?? 'NONE'
  const row = summary.habits.find((h) => h.key === def.habitKey)
  const daypart = (catalog?.chains ?? []).find((c) => c.chainKey === def.chainKey)?.daypart ?? 'MORNING'
  const recipe = recipeFromDef(def, (key) => defs.find((d) => d.habitKey === key)?.title)
  const done28 = row?.done28 ?? 0
  const missed28 = row?.missed28 ?? 0
  const toEditor = () => navigate(`/me/rutin/szokas/${habitKey}/szerkesztes`)

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin">
        <button type="button" className="mz-pgact" onClick={toEditor}>Szerkesztés</button>
      </PageHead>
      {/* Honesty rule: a definition with no summary row has no 28-day standing yet — show no
          number and no sub rather than a confident "0%  ·  0 pipa · 0 kihagyás". */}
      <PageHero
        icon={DAYPART_ICON[daypart]}
        iconSize={46}
        big={row?.strengthPct != null ? `${row.strengthPct}%` : undefined}
        name={def.title}
        sub={row != null ? `28 napos erő · ${done28} pipa · ${missed28} kihagyás` : undefined}
      />
      <PageBody principle={PRINCIPLE}>
        <EntranceGroup replayKey={def.id}>
          {/* A deep link to a PAUSED habit used to read exactly like an active one — the hub's
              dimming was the only signal anywhere, and it is not on this page. */}
          {!def.isActive && (
            <div className="rt-tip is-warn rise" style={rise(40)} data-testid="paused-note">
              <span aria-hidden="true">⏸</span>
              <span>
                <b>Szüneteltetve.</b> Ez a szokás most nem jelenik meg a Nap tabon — az erő-történet
                közben megmarad. A „Folytatás” a szerkesztő oldalon vár.
              </span>
            </div>
          )}

          {/* Everything below the hero is the habit's whole lifetime, and it renders only once
              the server's numbers are in — `realEmpty` carries thresholdPct 0, and a card drawn
              from that would print a confident zero during the loading window. */}
          {formation.thresholdPct > 0 && (
            <>
              <div className="rise" style={rise(60)}>
                <HabitFormationCard f={formation} />
              </div>
              <div className="rise" style={rise(80)}>
                <span className="rt-flabel">Kontextus <span className="rt-opt">a legerősebb jel</span></span>
                <HabitContextRings f={formation} anchored={def.anchorHabitKey != null} />
              </div>
              <div className="rt-fcard rise" style={rise(100)}>
                <span className="rt-flabel">Előzmény <span className="rt-opt">az első naptól</span></span>
                <HabitFormationHistory f={formation} />
              </div>
            </>
          )}

          {/* The recipe as a single read-only sentence (prototype `recView`): the details page
              never competes with a form. Both the head button and this row open the editor. */}
          <div className="rise" style={rise(130)}>
            <span className="rt-flabel">
              A recepted
              <button
                type="button"
                className="rt-fwband-sw"
                style={{ marginLeft: 'auto' }}
                onClick={toEditor}
              >
                ✎ szerkesztem ›
              </button>
            </span>
          </div>
          <div
            className={cn('rt-sentence is-big rise', def.framework === 'CLEAR' && 'is-clear')}
            style={rise(140)}
            data-testid="recipe-sentence"
          >
            <span className="rt-sentence-lb">{FW_LABEL[fwKey]}</span>
            <p className="rt-sentence-tx">
              {routineSentenceParts(recipe).map((part, i) => (
                part.slot === undefined
                  ? <span key={i}>{part.text}</span>
                  : <span key={i} className={cn('rt-blank', part.filled && 'is-filled')}>{part.text}</span>
              ))}
            </p>
          </div>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
