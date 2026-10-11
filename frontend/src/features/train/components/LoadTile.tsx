// ============================================================
// Mezo · LoadTile — a Heti terhelés-oldal belépő sora a szerkesztő heti arcán (mezo-yty6;
// Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `weekEd()` → „Heti terhelés · izmonként").
// A régi csempe mini-gauge-ai a hero edényeibe költöztek; itt a szám és a jelzések száma maradt.
// A napi terhelést a nap-arc hero-gombja nyitja.
// ============================================================
import { Row, St } from '@/shared/ui/folyadek'

interface LoadTileProps {
  title: string
  value: number
  /** Small print after the headline number, e.g. "szett · 1. hét". */
  unit: string
  /** How many lints touch this scope — the amber „N jelzés" pill. */
  flags?: number
  onOpen: () => void
}

export function LoadTile({ title, value, unit, flags = 0, onOpen }: LoadTileProps) {
  return (
    <Row
      icon="t-muscle"
      title={title}
      sub={`${value} ${unit}`}
      right={flags > 0 ? <St tone="warn">{flags} jelzés</St> : undefined}
      chev
      onClick={onOpen}
    />
  )
}
