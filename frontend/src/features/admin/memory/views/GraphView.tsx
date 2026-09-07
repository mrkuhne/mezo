import { MosaicDesktop, Tile } from '@/shared/ui/mozaik'

// Gráf (mezo-4qyt.4's target — d3-force layout, kind-coloured clay spots, evidence-carrying
// edges). This slice only renders the "készül" placeholder tile so the sub-nav and the
// inspector already work end-to-end; the real force layout lands in slice 4.
export function GraphView() {
  return (
    <MosaicDesktop>
      <Tile wash="lav" eyebrow="Gráf" span={12}>
        <div className="am-degraded">
          <div className="t">Készül</div>
          <p>A tudásgráf force-layout nézete a következő szeletben érkezik.</p>
        </div>
      </Tile>
    </MosaicDesktop>
  )
}
