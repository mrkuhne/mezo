import { describe, expect, it } from 'vitest'
import {
  APP_NOTIFICATION_KIND_META,
  notificationKindMeta,
  type AppNotificationKindKey,
} from '@/data/types'

// A backend `AppNotificationKind` enum 13 fajtát ismer (AppNotificationKind.java); ez a
// leképezés 12-t tartalmazott, és a `weekly_review_ready` hiánya az egész feed-oldalt az
// ErrorBoundary-ra dobta egy élő felhasználónál (mezo-ntf8). A két oldal külön nyelven él,
// tehát megint el fog csúszni — ezért a leképezés teljes ÉS a hozzáférés totális.
const BACKEND_KINDS = [
  'pattern_inbox', 'pattern_signal', 'hypothesis_new',
  'fact_candidate', 'fact_reinforced', 'memoir_ready',
  'prediction_new', 'prediction_outcome',
  'experiment_proposed', 'experiment_closed',
  'challenge_event', 'memory_note', 'weekly_review_ready',
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
