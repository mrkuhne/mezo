import { MosaicDesktop, Tile } from '@/shared/ui/mozaik'

// Térkép (mezo-4qyt.5's target — a umap-js worker projecting pgvector neighbours). This slice
// only renders the "készül" placeholder tile; the real scatter lands in slice 5.
export function MapView() {
  return (
    <MosaicDesktop>
      <Tile wash="sky" eyebrow="Térkép" span={12}>
        <div className="am-degraded">
          <div className="t">Készül</div>
          <p>A pgvector-szomszédság UMAP-térképe a következő szeletben érkezik.</p>
        </div>
      </Tile>
    </MosaicDesktop>
  )
}
