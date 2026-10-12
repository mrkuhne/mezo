// A Kamra betöltő arca (mezo-f2z; Folyadék F5, mezo-n4wf5.5 — prototípus `kamra.tolt`): a polc hőse négy üres
// üveggel, a számok helyén „—". Nem csontváz-csíkok: a lap alakja a hős, így a tartalom érkezése nem ugrik.
// A gyökér `role="status"` — erre vár a valódi módú teszt és a képernyőolvasó.
import { useM } from '@/shared/i18n'
import { Hero, HeroGraphic, Page, Vials, useFrameTitle, type VialItem } from '@/shared/ui/folyadek'
import { KAMRA_KINDS, KAMRA_KIND_ICON } from '@/features/fuel/logic/kamraItems'

export default function KamraSkeleton() {
  const M = useM()
  const K = M.fuelKamra
  useFrameTitle({ title: K.kamra.title, eyebrow: K.kamra.eyebrowLoading })
  const jars: VialItem[] = KAMRA_KINDS.map(k => ({ label: K.kindCap[k], icon: KAMRA_KIND_ICON[k], pct: 0, value: '—', note: K.kamra.jarNote }))
  return (
    <Page className="fp-kamra">
      <Hero role="status" aria-label={K.kamra.loadingVerdict} label={K.kamra.loadingLabel} verdict={K.kamra.loadingVerdict} sub={K.kamra.loadingSub}>
        <HeroGraphic><Vials items={jars} height={84} /></HeroGraphic>
      </Hero>
    </Page>
  )
}
