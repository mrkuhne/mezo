import type { AppNotificationView } from '@/data/types'

function at(daysAgo: number, hhmm: string): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Deterministic-shape feed seed: 3 unread today + 3 read older. */
export const notificationFeedSeed: AppNotificationView[] = [
  { id: 'nf-1', kind: 'pattern_inbox', title: 'Új minta vár döntésre', body: 'A késői vacsora és a felszínes alvás között erős jel rajzolódik ki — döntsd el, figyeljük-e.', deeplink: '/insights/patterns/late-meal-sleep', occurredAt: at(0, '06:12'), readAt: null },
  { id: 'nf-2', kind: 'prediction_outcome', title: 'Bejött egy előrejelzés', body: 'A korai lefekvés utáni jobb reggeli energia ma igazolódott.', deeplink: '/insights/predictions', occurredAt: at(0, '06:15'), readAt: null },
  { id: 'nf-3', kind: 'goal_suggestion', title: 'Új javaslat a célodhoz', body: 'Heti korrekció', deeplink: '/me/goals/weight/suggestions/sug-weekly-w17', occurredAt: at(0, '06:20'), readAt: null },
  { id: 'nf-4', kind: 'fact_candidate', title: 'Új tény vár jóváhagyásra', body: '„Edzés után 40 perccel esik legjobban az étkezés" — a beszélgetésből emeltem ki.', deeplink: '/mezo/knowledge', occurredAt: at(1, '21:40'), readAt: at(1, '22:00') },
  { id: 'nf-5', kind: 'fact_reinforced', title: 'Egy tudás megerősödött ×4', body: '„A hétvégi kimaradás után hétfőn nehezebb az edzés" — újra előjött ugyanabban az irányban.', deeplink: '/mezo/knowledge', occurredAt: at(1, '06:05'), readAt: at(1, '08:00') },
  { id: 'nf-6', kind: 'memoir_ready', title: 'Elkészült a heti memoár', body: 'A 33. hét története megírva — két minta és egy kísérlet köré épült.', deeplink: '/insights/memoir', occurredAt: at(2, '19:15'), readAt: at(2, '20:00') },
]
