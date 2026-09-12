// ============================================================
// Mezo · Fuel Trendek (mezo-o6uv, S0 váz — a tartalom az S3 szelet, mezo-83g0)
// A jóváhagyott negyedik Fuel-cél: „Jól ment a hetem?". Ez a fájl most csak a
// route-ot és a címet tartja, hogy a fülsor élő legyen; a heti kép, a napi
// üvegdoboz és a mutató-csempék az S3-ban érkeznek.
//
// Fülgyökér, ezért NINCS `PageHead`: a vissza-gombos fejlécet a shell adja, és a
// mozaik `PageHead`-je kötelező `onBack`-et kér (mozaik/index.tsx) — ugyanaz a
// fogás, mint a másik Fuel-fülgyökéren (`FuelStackPage`).
// ============================================================
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'

export function FuelTrendekPage() {
  return (
    <MozaikPage tone="sage">
      <PageBody>
        <h1>Trendek</h1>
        <p>A heti kép hamarosan itt lesz.</p>
      </PageBody>
    </MozaikPage>
  )
}
