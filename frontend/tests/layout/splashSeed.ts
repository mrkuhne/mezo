import type { Page } from '@playwright/test'

/**
 * „A bevezető már lefutott" seed a layout-harnesshez (mezo-u1n6l).
 *
 * A harness minden route-ot HIDEG betöltéssel jár be, és a `StartupSplash` három
 * másodpercig `aria-hidden`-re teszi a teljes tartalmat — egy szerep-alapú lekérdezés
 * (`getByRole`) ezért route-onként ~3,3 másodpercet vár. A `navigation.spec.ts` öt
 * domaint jár be tesztenként: ~17 másodperc a 30 másodperces keretből ment el a
 * bevezetőre, és CI-terhelés alatt ez borította a tesztet — mindig a kör KÉSŐBBI
 * doménjeinél, ezért tűnt renderelési résnek.
 *
 * A zászlót a `StartupSplash` CSAK fejlesztői buildben nézi meg (a harness `pnpm dev`-et
 * futtat); a szállított appban a bevezető változatlan. A `startup.spec.ts` MAGÁT a
 * bevezetőt méri — az nem használhatja ezt a seedet.
 */
export async function seedSplashSkipped(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mezo.splash.skip', '1'))
}
