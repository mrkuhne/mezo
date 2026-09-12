// ============================================================
// Mezo · Fuel Konyha (mezo-o6uv, S0 váz — a tartalom az S4 szelet, mezo-hygp)
// A jóváhagyott Fuel-cél, amibe a Receptek és a Kamra összeolvad. Ez a fájl most
// csak a route-ot és a címet tartja, hogy a fülsor élő legyen; a poszterek, a
// Receptek + recept-részlet, a Kamra + tétel-részlet és a Műhely az S4-ben érkeznek.
//
// Fülgyökér, ezért NINCS `PageHead`: a vissza-gombos fejlécet a shell adja, és a
// mozaik `PageHead`-je kötelező `onBack`-et kér (mozaik/index.tsx) — ugyanaz a
// fogás, mint a másik Fuel-fülgyökéren (`FuelStackPage`).
// ============================================================
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'

export function FuelKonyhaPage() {
  return (
    <MozaikPage tone="gold">
      <PageBody>
        <h1>Konyha</h1>
        <p>A receptek és a kamra hamarosan itt lesznek.</p>
      </PageBody>
    </MozaikPage>
  )
}
