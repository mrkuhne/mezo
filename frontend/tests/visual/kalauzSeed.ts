import type { Page } from '@playwright/test'
import { buildAllSeenProgress } from '../../src/test/kalauz'

/**
 * „Minden kalauz látva" seed a Playwright-harnesshez (mezo-gb1s.6).
 *
 * A helper eredetileg a `visual.spec.ts`-ben élt (mezo-gb1s.5), és csak a goldeneket
 * védte — de a `layout.spec.ts` ugyanazokat a route-okat járja, KATTINTÁSSAL: az S3b
 * `/fuel/log` kalauza (T2, auto-open) reduced-motion alatt a 0 ms-os sheetjével elnyelte
 * a „Logold · …" CTA kattintását, és a Kamra-picker teszt 30 s-en timeoutolt. Egy helyen
 * él, a REGISTRYBŐL generálva, tehát a további tartalom-szeletek (S3c–d, S4) egyik
 * spec-fájlt sem tudják ugyanígy eltörni.
 */
export async function seedKalauzSeen(page: Page) {
  const seen = JSON.stringify(buildAllSeenProgress())
  await page.addInitScript((s) => localStorage.setItem('mezo.kalauz.v1', s), seen)
}

/** Téma + kalauz-seed EGY init-scriptben — a goldenek ezt hívják. */
export async function seedThemeAndKalauz(page: Page, theme: string) {
  const seen = JSON.stringify(buildAllSeenProgress())
  await page.addInitScript(([t, s]) => {
    localStorage.setItem('mezo-theme', t)
    localStorage.setItem('mezo.kalauz.v1', s)
  }, [theme, seen] as const)
}
