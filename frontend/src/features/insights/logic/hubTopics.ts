import type { Icon3DName } from '@/shared/ui/clay'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'

export type ObsTopic = 'Alvás' | 'Edzés' | 'Étkezés' | 'Kapcsolatok' | 'Hangulat' | 'Egyéb'
export const OBS_TOPICS: ObsTopic[] = ['Alvás', 'Edzés', 'Étkezés', 'Kapcsolatok', 'Hangulat', 'Egyéb']
export const TOPIC_ICON: Record<ObsTopic, Icon3DName> = {
  Alvás: 't-sleep', Edzés: 't-dumbbell', Étkezés: 't-bowl', Kapcsolatok: 't-people', Hangulat: 't-spark', Egyéb: 't-pattern',
}

const SOURCE_TOPIC: Record<string, ObsTopic> = {
  sleep_log: 'Alvás',
  workout_session: 'Edzés', exercise: 'Edzés', exercise_set: 'Edzés', exercise_feedback: 'Edzés',
  run_session_log: 'Edzés', sport_session: 'Edzés', sport_event: 'Edzés', activity_log: 'Edzés',
  meal: 'Étkezés', meal_item: 'Étkezés', water_log: 'Étkezés', weight_log: 'Étkezés',
  check_in: 'Hangulat', journal_entry: 'Hangulat', gratitude_entry: 'Hangulat', ai_message: 'Hangulat',
  ritual_day: 'Hangulat', daily_intention: 'Hangulat', intention_focus: 'Hangulat', habit_day: 'Hangulat',
}

/** Egy észrevétel témája (S6): személy-téma-kulcs ⇒ Kapcsolatok; különben a bizonyíték-rekordok
 *  többségi NYERS forrás-kulcsa (evidenceSources — a mapEvidence előtti drót-érték); rekord nélkül
 *  Egyéb. Determinisztikus: döntetlennél az OBS_TOPICS sorrend dönt. */
export function topicOf(o: KnowledgeObservation): ObsTopic {
  if (o.topicKey && o.topicKey.split('-').includes('person')) return 'Kapcsolatok'
  const tally = new Map<ObsTopic, number>()
  for (const source of o.evidenceSources) {
    const topic = SOURCE_TOPIC[source]
    if (topic) tally.set(topic, (tally.get(topic) ?? 0) + 1)
  }
  let best: ObsTopic = 'Egyéb'
  let bestN = 0
  for (const t of OBS_TOPICS) {
    const n = tally.get(t) ?? 0
    if (n > bestN) { best = t; bestN = n }
  }
  return best
}

export function groupBy<T, K extends string>(items: T[], key: (t: T) => K, order: K[]): Array<{ key: K; items: T[] }> {
  return order
    .map((k) => ({ key: k, items: items.filter((i) => key(i) === k) }))
    .filter((g) => g.items.length > 0)
}
