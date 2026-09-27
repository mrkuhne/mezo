import type { EffectSubject, KnowledgeFact, PersonEntry } from '@/data/types'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'
import { heroNote, tileSub } from '@/features/insights/logic/hubCopy'

/** One hub source as the page sees it: its items plus the honest load state (S6, mezo-d6ivw.6). */
export interface Loadable<T> { items: T; degraded: boolean; isPending: boolean; isError: boolean; refetch: () => void }
export type SectionLoadState = 'ok' | 'loading' | 'error' | 'off'
export interface SectionCount { state: SectionLoadState; total: number; muted: number; sub: string; retry?: () => void }

function state(l: { degraded: boolean; isPending: boolean; isError: boolean }): SectionLoadState {
  return l.isPending ? 'loading' : l.isError ? 'error' : l.degraded ? 'off' : 'ok'
}

/** An observation's standing, as the hub tile AND the Észrevételek chips count it (the
 *  prototype's `ost`): `felul` when its fact is muted as superseded, or when a newer observation
 *  replaced it and it has no fact of its own; `elh` when it or its fact is muted (refuted / by the
 *  user); else `igaz` — including a replaced older half whose fact the user switched back on. */
export function obsState(o: KnowledgeObservation): 'igaz' | 'felul' | 'elh' {
  if (o.factMutedReason === 'superseded') return 'felul'
  if (o.factMutedReason || o.status === 'refuted') return 'elh'
  if (o.replacedByPatternId && !o.factId) return 'felul'
  return 'igaz'
}

/**
 * The hub's four section counts and the hero number. Only sections that actually loaded are
 * counted — a loading/failed/switched-off section contributes nothing (never an invented zero).
 * An observation and the fact learned from it are ONE thing: observations count only while the
 * facts section is unavailable.
 */
export function hubCounts(facts: Loadable<KnowledgeFact[]>, people: Loadable<PersonEntry[]>,
                          obs: Loadable<KnowledgeObservation[]>, effects: Loadable<EffectSubject[]>) {
  const f = facts.items, pf = people.items.flatMap((p) => p.facts), o = obs.items, e = effects.items
  const fMuted = f.filter((x) => !x.active).length
  const pMuted = pf.filter((x) => !x.includeInPrompt).length
  const oStates = o.map(obsState)
  const oSup = oStates.filter((s) => s === 'felul').length
  const oMuted = oStates.filter((s) => s === 'elh').length
  const eMuted = e.filter((x) => x.muted).length
  const sections = {
    facts: { state: state(facts), total: f.length, muted: fMuted, sub: tileSub.facts(f.length - fMuted, fMuted), retry: facts.refetch },
    people: {
      state: state(people), total: pf.length, muted: pMuted,
      sub: tileSub.people(people.items.filter((p) => p.facts.length).length, pMuted), retry: people.refetch,
    },
    observations: {
      state: state(obs), total: o.length, muted: oMuted + oSup,
      sub: tileSub.observations(o.length - oMuted - oSup, oSup, oMuted), retry: obs.refetch,
    },
    effects: {
      state: state(effects), total: e.length, muted: eMuted,
      sub: tileSub.effects(
        e.filter((x) => x.kind === 'person' && !x.muted).length,
        e.filter((x) => x.kind === 'event' && !x.muted).length,
        eMuted,
      ),
      retry: effects.refetch,
    },
  } satisfies Record<string, SectionCount>
  // An observation and the fact learned from it are ONE thing — counted once (via the fact).
  const counted = (['facts', 'people', 'observations', 'effects'] as const)
    .filter((k) => sections[k].state === 'ok' && !(k === 'observations' && sections.facts.state === 'ok'))
  const total = counted.reduce((n, k) => n + sections[k].total, 0)
  const muted = counted.reduce((n, k) => n + sections[k].muted, 0)
  const all = Object.values(sections)
  const note = sections.facts.state === 'off' ? heroNote('off')
    : all.some((s) => s.state === 'loading' || s.state === 'error') ? heroNote('partial')
    : heroNote('ok')
  /** The hero shows a number only when at least one section was actually counted; otherwise it
   *  says why there is none (still loading / nothing available) — never an invented 0. */
  const hero: 'number' | 'loading' | 'unavailable' = counted.length > 0 ? 'number'
    : all.some((s) => s.state === 'loading') ? 'loading' : 'unavailable'
  return { sections, total, muted, note, hero }
}
export type HubCounts = ReturnType<typeof hubCounts>
