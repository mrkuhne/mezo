// ============================================================
// Mezo · A shell-fejléc bal oldala: melyik SZEKCIÓBAN vagyunk (mezo-8az6).
// 115 route van, ezért nincs route→cím tábla: a címke a path ELSŐ szegmenséből
// jön, szekció-szinten. A mélyoldal pontos címét a saját PageHead-je adja; a
// fejléc csak a „hol vagyok"-ot mutatja — így új route sosem igényel itt bővítést.
// Ismeretlen szegmensre `null`: a fejléc bal oldala üresen marad (honest state).
// ============================================================
import type { ClaySpotName } from '@/shared/ui/clay'

export interface HeaderSection {
  label: string
  spot: ClaySpotName
}

// A tab-gyökerek a TabBar sorrendjében. A Mezo tudatosan `s-orb-figyel`, nem `s-orb`:
// az utóbbi betűre ugyanaz, mint a fejléc jobb szélén ülő profil-orb.
const SECTIONS: Record<string, HeaderSection> = {
  nap: { label: 'Nap', spot: 's-reggel' },
  train: { label: 'Edzés', spot: 's-edzes' },
  fuel: { label: 'Fuel', spot: 's-fuel' },
  mezo: { label: 'Mezo', spot: 's-orb-figyel' },
  me: { label: 'Én', spot: 's-en' },
}

export function sectionFor(pathname: string): HeaderSection | null {
  const first = pathname.split('/').filter(Boolean)[0]
  return (first && SECTIONS[first]) ?? null
}
