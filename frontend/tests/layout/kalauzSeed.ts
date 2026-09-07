import type { Page } from '@playwright/test'
import { buildAllSeenProgress } from '../../src/test/kalauz'

/**
 * „Minden kalauz látva" seed a Playwright-harnesshez (mezo-gb1s.6).
 *
 * A `layout.spec.ts` route-okat jár be, KATTINTÁSSAL: az S3b `/fuel/log` kalauza (T2,
 * auto-open) reduced-motion alatt a 0 ms-os sheetjével elnyelte a „Logold · …" CTA
 * kattintását, és a Kamra-picker teszt 30 s-en timeoutolt. A seed a REGISTRYBŐL generál,
 * tehát a további tartalom-szeletek (S3c–d, S4) nem tudják ugyanígy eltörni.
 */
export async function seedKalauzSeen(page: Page) {
  const seen = JSON.stringify(buildAllSeenProgress())
  await page.addInitScript((s) => localStorage.setItem('mezo.kalauz.v1', s), seen)
}
