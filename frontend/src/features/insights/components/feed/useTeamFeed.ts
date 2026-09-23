import { useMemo } from 'react'
import {
  useCharacterFeed, useExperiments, useObservations, usePatternMonitor, usePatterns, usePredictions,
} from '@/data/hooks'
import { buildTeamFeed } from '@/features/insights/logic/teamFeed'
import { localDateString } from '@/shared/lib/dates'

/**
 * A csapat poszt-folyama a meglévő hookokból (mezo-a9bo7.8/.9) — a fal és a szobák EGY forrása.
 * `loading` a betöltés-kapu: az üres-állapot előtt kell vizsgálni (mezo-yew), különben félkész
 * adatból villan fel a „csend van”.
 */
export function useTeamFeed() {
  const patterns = usePatterns()
  const monitor = usePatternMonitor()
  const predictions = usePredictions()
  const experiments = useExperiments()
  const observations = useObservations()
  const characterFeed = useCharacterFeed(60)
  const today = localDateString()

  const loading = patterns.isPending || monitor.isPending || predictions.isPending
    || experiments.isPending || observations.isPending || characterFeed.isLoading
  const pairs = monitor.monitor?.pairs
  const feed = useMemo(() => buildTeamFeed({
    patterns: patterns.patterns,
    monitorPairs: pairs ?? [],
    predictions: predictions.predictions,
    experiments: experiments.experiments,
    observations: observations.observations,
    characterItems: characterFeed.items,
    today,
  }), [patterns.patterns, pairs, predictions.predictions, experiments.experiments,
    observations.observations, characterFeed.items, today])

  return {
    feed,
    today,
    loading,
    degraded: patterns.degraded || observations.degraded,
    patterns: patterns.patterns,
    pairs: pairs ?? [],
  }
}
