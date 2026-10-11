import { Card, Row } from '@/shared/ui/folyadek'

/**
 * Derived, presentational cross-load note — sprint eccentric load carries over to gym leg
 * volume, like the volleyball cross-load. Phase 2 shows it statically; wiring into the
 * volume-recompute engine is Phase 3.
 * Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `futas('het')` section 2): one white
 * card with one row — the chain glyph, what changes, and why in plain words.
 */
export function RunCrossLoadCard() {
  return (
    <Card className="es-xrun">
      <Row
        icon="t-chain"
        title="Comb / Lábhajlító · −2 szett"
        sub="A sprintek a combot és a lábhajlítót is terhelik, ezért a heti láb-szettekből kettőt levonunk — ugyanúgy, mint a röplabdánál."
      />
    </Card>
  )
}
