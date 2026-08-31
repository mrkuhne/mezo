// ============================================================
// Mezo · PrepKuldetesekPage — the prep mosaic's Küldetések tile opened into
// its own page (mezo-d20.3.8). Source: session-body.html #page-kuld.
// Compact hero (accepted/total) + stat strip + a vertical stack of the
// EXISTING ChallengeCard (mode-aware accept/dismiss, conf%/tools/refs,
// resolved outcome states) — same accept/pass contract as the old carousel,
// just off the hub and without the horizontal scroll-snap rail.
// ============================================================
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { ChallengeCard } from '@/features/train/components/ChallengeCard'
import { ChallengeGenerationLoader } from '@/features/train/components/ChallengeGenerationLoader'
import type { Challenge } from '@/data/types'

export function PrepKuldetesekPage({ challenges, accepted, onToggle, pending, onBack }: {
  challenges: Challenge[]
  accepted: Record<string, boolean>
  onToggle: (id: string) => void
  pending: boolean
  onBack: () => void
}) {
  const acceptedCount = challenges.filter((c) => accepted[c.id]).length
  return (
    <MozaikPage tone="coral">
      <PageHead label="‹ Indítás" onBack={onBack} />
      <PageHero icon="i-kihivas" big={pending ? '–/–' : `${acceptedCount}/${challenges.length}`} name="A mai küldetések" />
      <PageBody principle="Passzolni ér — a kihívás ajánlat, nem elvárás. Az eredmény a záráskor derül ki, és sosem piros.">
        <StatStrip className="mt-sm">
          <StatCell value={pending ? '…' : challenges.length} label="ajánlat ma" />
          <StatCell value={pending ? '…' : acceptedCount} label="elfogadva" />
        </StatStrip>
        <div className="col gap-md mt-md">
          {pending ? (
            <ChallengeGenerationLoader />
          ) : challenges.length === 0 ? (
            <span className="text-tertiary" style={{ fontSize: 13 }}>Ma nincs kihívás</span>
          ) : (
            <EntranceGroup className="col gap-md">
              {challenges.map((c) => (
                <ChallengeCard key={c.id} challenge={c} accepted={!!accepted[c.id]} onToggle={() => onToggle(c.id)} />
              ))}
            </EntranceGroup>
          )}
        </div>
      </PageBody>
    </MozaikPage>
  )
}
