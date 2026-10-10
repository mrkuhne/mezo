// ============================================================
// Mezo · HabitPage (mezo-3zue.4, split by mezo-bk26; Folyadék F2 mezo-n4wf5.2) —
// /nap/rutin/szokas/:habitKey, prototype vilagos/nap.js `szokas`. ONE habit's DETAILS: the
// ripening vessel in the hero, the recipe as a READ-ONLY sentence, the context levels, the
// formation surface and the lifetime history. Every write — fields, framework, anchor, mode,
// chain, xp, pause, delete — lives on the editor's own page (`/szerkesztes`, HabitEditPage): the
// in-place form was built first and failed in use, because this page grew long enough that the
// editor opened below the fold (choice board rutin-szerkeszto-valasztas.html, option B).
//
// The page NEVER ticks a habit (ADR — ticking lives on /nap/rutin).
// ============================================================
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useHabitCatalog, useHabitFormation, useHabitSummary } from '@/data/hooks'
import { FormationCurve } from '@/features/me/components/FormationCurve'
import { HabitContextRings } from '@/features/me/components/HabitContextRings'
import { formationReading, HabitFormationCard } from '@/features/me/components/HabitFormationCard'
import { HabitFormationHistory } from '@/features/me/components/HabitFormationHistory'
import { FW_NAME, RbBack, RecipeSentence, RecipeVessels, recipeParts } from '@/features/me/components/routineBits'
import { recipeFromDef } from '@/features/me/logic/routineSentence'
import { Acts, Btn, Card, ErrorRow, Hero, Lk, Note, Page, Section, Why, useFrameTitle } from '@/shared/ui/folyadek'

export function HabitPage() {
  const navigate = useNavigate()
  const { habitKey = '' } = useParams<{ habitKey: string }>()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { data: summary } = useHabitSummary()
  const { data: formation } = useHabitFormation(habitKey)

  const defs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  const def = defs.find((d) => d.habitKey === habitKey)
  // The title bar names the habit and its owning chain (the chain carries the daypart).
  const chainTitle = def != null ? (catalog?.chains ?? []).find((c) => c.chainKey === def.chainKey)?.title : undefined
  useFrameTitle({
    title: def?.title,
    eyebrow: def != null ? `Szokás${chainTitle ? ` · ${chainTitle}` : ''}` : undefined,
  })

  // A deep link lands here before the catalog has resolved: bouncing then would eject the
  // user from a perfectly valid habit. Only a RESOLVED catalog that has no such key redirects.
  if (def == null) {
    if (isPending) {
      return (
        <Page>
          <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
          <Card><Note>Szokás betöltése…</Note></Card>
        </Page>
      )
    }
    // A FAILED fetch is not a resolved miss: bouncing on it ejected the user from a habit that
    // exists, with no word about the failure. Only a catalog that actually answered redirects.
    if (isError) {
      return (
        <Page>
          <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
          <Card><ErrorRow message="Nem sikerült betölteni a szokást." onRetry={refetch} /></Card>
        </Page>
      )
    }
    return <Navigate to="/nap/rutin/epites" replace />
  }

  const row = summary.habits.find((h) => h.key === def.habitKey)
  const recipe = recipeFromDef(def, (key) => defs.find((d) => d.habitKey === key)?.title)
  const toEditor = () => navigate(`/nap/rutin/szokas/${habitKey}/szerkesztes`)
  // Everything about the habit's lifetime renders only once the server's numbers are in —
  // `realEmpty` carries thresholdPct 0, and a vessel drawn from that would print a confident
  // zero during the loading window.
  const resolved = formation.thresholdPct > 0
  const reading = resolved ? formationReading(formation) : null
  // Honesty rule: a definition with no summary row has no 28-day standing yet — say nothing
  // rather than a confident „0% · 0 pipa · 0 kihagyás".
  const standing = row != null ? `${row.done28 ?? 0} pipa · ${row.missed28 ?? 0} kihagyás.` : null
  const hasCurve = formation.curveK != null && formation.curveK > 0

  return (
    <Page>
      <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
      <Hero
        label={`Út az automatizmus felé${row?.strengthPct != null ? ` · 28 napos erő ${row.strengthPct}%` : ''}`}
        verdict={reading != null
          ? <span data-testid="formation-eta">{reading.verdict}</span>
          : 'Számolom, hol tart ez a szokás…'}
        sub={[standing, reading?.note].filter(Boolean).join(' ') || undefined}
        actions={<Btn onClick={toEditor}>Szerkesztés</Btn>}
      >
        {resolved && <HabitFormationCard f={formation} />}
      </Hero>

      {/* A deep link to a PAUSED habit used to read exactly like an active one — the hub's
          dimming was the only signal anywhere, and it is not on this page. */}
      {!def.isActive && (
        <Card className="rb-card-why" data-testid="paused-note">
          <Why icon="t-hold">
            <b>Szüneteltetve.</b> Ez a szokás most nem jelenik meg a Rutin fülön — az erő-történet
            közben megmarad. A „Folytatás” a szerkesztő oldalon vár.
          </Why>
        </Card>
      )}

      {/* The recipe as a single read-only sentence: the details page never competes with a form.
          Both the hero button and this link open the editor. */}
      <Section n={1} title="A recepted" link={FW_NAME[def.framework ?? 'NONE']} />
      <Card>
        <RecipeVessels parts={recipeParts(recipe)} />
        <RecipeSentence recipe={recipe} testId="recipe-sentence" />
        <Acts><Lk onClick={toEditor}>Szerkesztem</Lk></Acts>
      </Card>

      {resolved && (
        <>
          <Section n={2} title="Mikor megy a legjobban" />
          <Card>
            <HabitContextRings f={formation} anchored={def.anchorHabitKey != null} />
            <Note>A legerősebb jel a kontextus: mikor, mi után és milyen napokon megy magától.</Note>
          </Card>

          {hasCurve && (
            <>
              <Section n={3} title="Így épült" />
              <Card>
                <FormationCurve curveK={formation.curveK} reps={formation.reps} thresholdPct={formation.thresholdPct} />
                <Note>
                  A felszín az ismétlésekkel emelkedik, nem a naptári napokkal. A szaggatott vonal a
                  „magától megy” küszöb ({formation.thresholdPct}%).
                </Note>
              </Card>
            </>
          )}

          <Section
            n={hasCurve ? 4 : 3}
            title={formation.days.length > 0 ? `Előzmény · az első naptól · ${formation.days.length} nap` : 'Előzmény'}
          />
          <Card>
            <HabitFormationHistory f={formation} />
          </Card>
        </>
      )}
    </Page>
  )
}
