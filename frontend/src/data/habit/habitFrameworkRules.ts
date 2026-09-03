// ============================================================
// Mezo · habitFrameworkRules — a backend HabitFrameworkValidator FE-tükre (mezo-3zue.8).
// Egyetlen igazságforrás: backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/
// HabitFrameworkValidator.java. Ez a modul LEKÉPEZI azt, nem újraértelmezi: ahol a Java
// szabálya meglepő, itt is meglepő, kommenttel. A mock-arm (habitAdminHooks.ts) ezt hívja,
// hogy egy FOGG→CLEAR átkeretezés offline ugyanazt tegye, mint valós módban.
// Tiszta: nincs hook, nincs cache, nincs I/O.
// ============================================================
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

/** A def keret-releváns szelete — a mutátorok teljes `HabitDefInfo`-t adnak, de csak ez számít. */
export type FrameworkDraft = Pick<HabitDefInfo,
  'habitKey' | 'framework' | 'anchorHabitKey' | 'anchorCopy'
  | 'cue' | 'craving' | 'reward' | 'celebration' | 'identity'>

/** A Java `isSet` tükre: a null és a csak-whitespace érték egyaránt „nincs kitöltve". */
function isSet(value: string | null | undefined): boolean {
  return value != null && value.trim() !== ''
}

/**
 * A `clearForeignFields` tükre: leveszi a mezőket, amiket a választott keret nem birtokol.
 * A backend a managed entitást mutálja; itt ÚJ objektumot adunk vissza, mert a React Query
 * cache-be írt def sosem mutálható helyben.
 */
export function clearForeignFields<T extends FrameworkDraft>(draft: T): T {
  if (draft.framework === 'FOGG') {
    return { ...draft, cue: null, craving: null, reward: null, identity: null }
  }
  if (draft.framework === 'CLEAR') {
    // Az anchorCopy IS megy: a Nap felületen ki van rajzolva (`.nr-anchor` + a todayItems
    // alcím), tehát egy megtartott „miután …" hamis jelzést hagyna egy Clear recept alatt.
    return { ...draft, anchorHabitKey: null, anchorCopy: null, celebration: null }
  }
  return draft
}

/**
 * A `validate` tükre — a def ÖSSZEFÉSÜLT, írás UTÁNI állapotát nézi, tehát mindig
 * `clearForeignFields` UTÁN kell hívni (ez a HabitAdminService.createDef/updateDef sorrendje).
 * Dob `Error(<CODE>)`-ot, ahol a backend 400-at adna — a mock-mutátorok meglévő
 * `throw new Error('HABIT_CHAIN_SEED')` precedensének alakjában.
 */
export function validateFramework(draft: FrameworkDraft, catalog: HabitCatalog): void {
  if (draft.framework == null) {
    // FIGYELEM: az `anchorCopy` SZÁNDÉKOSAN nincs ezen a listán — a backend `hasAny(...)`
    // hívása sem sorolja fel (HabitFrameworkValidator.java:31-34). Keret nélküli def tehát
    // hordozhat szabad szöveges horgonyt; a teljes valós seed pontosan ilyen.
    const orphan = [draft.anchorHabitKey, draft.cue, draft.craving,
      draft.reward, draft.celebration, draft.identity].some(isSet)
    if (orphan) throw new Error('HABIT_FRAMEWORK_FIELDS_ORPHAN')
    return
  }
  if (draft.framework === 'FOGG') {
    const hasAnchor = isSet(draft.anchorHabitKey) || isSet(draft.anchorCopy)
    if (!hasAnchor || !isSet(draft.celebration)) {
      throw new Error('HABIT_FRAMEWORK_FOGG_INCOMPLETE')
    }
    validateAnchorReference(draft, catalog)
    return
  }
  if (!isSet(draft.cue) || !isSet(draft.craving) || !isSet(draft.reward)) {
    throw new Error('HABIT_FRAMEWORK_CLEAR_INCOMPLETE')
  }
}

/**
 * A `validateAnchorReference` tükre. A backend a horgonyt a def SAJÁT tulajdonosának körén
 * belül keresi (`findByCreatedByAndHabitKeyAndDeletedFalse`); mock módban egyetlen felhasználó
 * van, ezért a katalógus maga a tulajdonosi kör — a más-felhasználós ág valós módban él, és a
 * HabitAdminApiIT fedi (mezo-3zue.7).
 */
function validateAnchorReference(draft: FrameworkDraft, catalog: HabitCatalog): void {
  const anchorKey = draft.anchorHabitKey
  if (!isSet(anchorKey)) return // csak szabad szöveges horgony
  if (anchorKey === draft.habitKey) throw new Error('HABIT_ANCHOR_INVALID')
  const anchor = catalog.chains.flatMap((c) => c.defs).find((d) => d.habitKey === anchorKey)
  if (!anchor || anchor.isActive !== true) throw new Error('HABIT_ANCHOR_INVALID')
}
