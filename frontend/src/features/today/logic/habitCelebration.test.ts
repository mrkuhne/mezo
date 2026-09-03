import { describe, expect, test } from 'vitest'
import { celebrationFor } from '@/features/today/logic/habitCelebration'
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

/** A def fixture: csak az számít, amit a lookup olvas — a többi mező kitöltése zaj lenne. */
function def(habitKey: string, celebration: string | null): HabitDefInfo {
  return { habitKey, celebration } as HabitDefInfo
}

const catalog: HabitCatalog = {
  chains: [
    { chainKey: 'MORNING', defs: [def('wake_on_time', null), def('morning_pushups', 'ökölbe szorított kéz')] },
    { chainKey: 'EVENING', defs: [def('kitchen_close', 'lekapcsolom a lámpát')] },
  ] as HabitCatalog['chains'],
}

describe('celebrationFor', () => {
  test('megtalálja a szokás saját ünneplését, láncon átívelve is', () => {
    expect(celebrationFor(catalog, 'morning_pushups')).toBe('ökölbe szorított kéz')
    expect(celebrationFor(catalog, 'kitchen_close')).toBe('lekapcsolom a lámpát')
  })

  test('null, ha a defnek nincs ünneplése', () => {
    expect(celebrationFor(catalog, 'wake_on_time')).toBeNull()
  })

  test('null, ha a kulcs nincs a katalógusban', () => {
    expect(celebrationFor(catalog, 'nincs_ilyen')).toBeNull()
  })

  test('null üres katalógusra — ez a hálózati hiba / stale ablak ága, nem hiba', () => {
    expect(celebrationFor({ chains: [] }, 'morning_pushups')).toBeNull()
  })

  test('a csak whitespace-t tartalmazó ünneplés is null, nem üres sor a toastban', () => {
    const c: HabitCatalog = { chains: [{ chainKey: 'MORNING', defs: [def('x', '   ')] }] as HabitCatalog['chains'] }
    expect(celebrationFor(c, 'x')).toBeNull()
  })
})
