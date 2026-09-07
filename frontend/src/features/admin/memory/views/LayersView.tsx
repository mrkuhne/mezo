import { MosaicDesktop, Tile } from '@/shared/ui/mozaik'

// Rétegek (mezo-4qyt.6's target — vector/graph health rollups as StatCells). This slice only
// renders the "készül" placeholder tile; the real health dashboard lands in slice 6.
export function LayersView() {
  return (
    <MosaicDesktop>
      <Tile wash="gold" eyebrow="Rétegek" span={12}>
        <div className="am-degraded">
          <div className="t">Készül</div>
          <p>A vektor- és gráf-egészség áttekintése a következő szeletben érkezik.</p>
        </div>
      </Tile>
    </MosaicDesktop>
  )
}
