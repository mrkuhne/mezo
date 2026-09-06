import { describe, expect, it } from 'vitest'
import {
  APP_NOTIFICATION_KIND_META,
  notificationKindMeta,
  type AppNotificationKindKey,
} from '@/data/types'

// A backend `AppNotificationKind` enum 19 fajtát ismer (AppNotificationKind.java); ez a
// leképezés egyszer 12-t tartalmazott, és a `weekly_review_ready` hiánya az egész feed-oldalt
// az ErrorBoundary-ra dobta egy élő felhasználónál (mezo-ntf8). A két oldal külön nyelven él,
// tehát megint el fog csúszni — ezért a leképezés teljes ÉS a hozzáférés totális.
const BACKEND_KINDS = [
  'pattern_inbox', 'pattern_signal', 'hypothesis_new',
  'fact_candidate', 'fact_reinforced', 'memoir_ready',
  'prediction_new', 'prediction_outcome',
  'experiment_proposed', 'experiment_closed',
  'challenge_event', 'memory_note', 'weekly_review_ready',
  'life_goal_plan', 'goal_suggestion',
  // mezo-0cbh
  'person_candidate', 'graph_candidate', 'habit_formation', 'character_portrait',
] as const

describe('APP_NOTIFICATION_KIND_META', () => {
  it('minden backend-fajtát lefed', () => {
    for (const kind of BACKEND_KINDS) {
      expect(APP_NOTIFICATION_KIND_META[kind as AppNotificationKindKey]).toBeDefined()
    }
    expect(Object.keys(APP_NOTIFICATION_KIND_META)).toHaveLength(BACKEND_KINDS.length)
  })

  it('a heti értesítés a heti clay ikont viszi', () => {
    expect(APP_NOTIFICATION_KIND_META.weekly_review_ready.clay).toBe('i-heti')
  })

  it('az életcél-terv a cél clay ikonját viszi', () => {
    expect(APP_NOTIFICATION_KIND_META.life_goal_plan.clay).toBe('i-cel')
  })

  it('a céljavaslat a cél clay ikonját és goal tintet viszi', () => {
    expect(APP_NOTIFICATION_KIND_META.goal_suggestion).toMatchObject({ clay: 'i-cel', tint: 'goal' })
  })

  // mezo-0cbh: a négy új fajta a saját ikonkészletünkből kap ikont, és a három új tintnek
  // (`people`/`habit`/`character`) VAN CSS-szabálya — egy tint-név elgépelése némán
  // hátterrel nem rendelkező ikon-tokot adna.
  it('a négy új fajta a saját clay ikonját és tintjét viszi', () => {
    expect(APP_NOTIFICATION_KIND_META.person_candidate).toMatchObject({ clay: 'i-emberek', tint: 'people' })
    expect(APP_NOTIFICATION_KIND_META.graph_candidate).toMatchObject({ clay: 'i-retegek', tint: 'people' })
    expect(APP_NOTIFICATION_KIND_META.habit_formation).toMatchObject({ clay: 'i-termes', tint: 'habit' })
    expect(APP_NOTIFICATION_KIND_META.character_portrait).toMatchObject({ clay: 'i-eletjel', tint: 'character' })
  })
})

describe('notificationKindMeta', () => {
  it('a leképezett fajtára a saját bejegyzését adja', () => {
    expect(notificationKindMeta('memoir_ready')).toBe(APP_NOTIFICATION_KIND_META.memoir_ready)
  })

  // A védelem lényege: egy JÖVŐBELI backend-fajta ne dönthesse el az oldalt. Ismeretlen
  // kulcsra semleges bejegyzés jár, nem `undefined`.
  it('ismeretlen fajtára semleges bejegyzést ad, nem dob', () => {
    const meta = notificationKindMeta('brand_new_backend_kind')
    expect(meta).toBeDefined()
    expect(meta.clay).toBe('i-ertesites')
    expect(typeof meta.tint).toBe('string')
  })
})
