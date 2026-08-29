// ============================================================
// Mezo · MesoOverviewPage — the Mezociklus hub's "Volumen" tile subpage
// (mezo-d20.3.6). Mozaik re-face: source of truth is the mezociklus
// prototype's #page-vol (meso-body.html, px ×1.18) — live-system banner,
// "Honnan jönnek a számok?" intro, one provenance bar per muscle group
// (MEV/MAV/MRV zones + the tappable 01 Baseline → 02 Daniel-személyre
// szabás → 03 Eredő·most derivation), Mezo suggestion card, closing
// principle line. That whole anatomy already exists as `MesoVolume` +
// `VolumeBar` (ported from the pre-redesign builder tab) — reused
// UNCHANGED here (recompose, not reinvent): this page only supplies the
// new subpage scaffold (MozaikPage/PageHead/PageHero) around it. Sibling
// route to MesocycleBuilderPage, reached from the hub's `Volumen` tile;
// its own guard (planned/archived → no live volume profile) is
// `MesoVolume`'s, unchanged.
// ============================================================
import { useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { MesoVolume } from '@/features/train/components/MesoVolume'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { CtaGhost } from '@/shared/ui/Cta'

export function MesoOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const goBack = useBackNav('/train/mesocycles')
  const { mesocycles } = useTrain()
  const meso = mesocycles.find((m) => m.id === id)

  if (!meso) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ Mezociklus" />
        <PageBody>
          <p className="text-secondary" style={{ fontSize: 13 }}>
            Ez a mesociklus nem található.
          </p>
          <div className="mt-lg">
            <CtaGhost onClick={goBack}>← Mezociklus</CtaGhost>
          </div>
        </PageBody>
      </MozaikPage>
    )
  }

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={goBack} label="‹ Mezociklus" />
      <EntranceGroup>
        <PageHero icon="i-meso" big={`W${meso.currentWeek}`} name="Volumen · élő rendszer" />
        <PageBody principle="A módosítás a következő heti görgetésnél lép életbe. A baseline sosem íródik felül — csak igazítások rétegződnek rá.">
          <MesoVolume meso={meso} />
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
