import { useMemo } from 'react'
import {
  useCharacterFeed, useExperiments, useObservations, usePatternMonitor, usePatterns, usePredictions, useTeamEditions,
} from '@/data/hooks'
import { mergeWall } from '@/features/insights/logic/teamEdition'
import { buildTeamFeed } from '@/features/insights/logic/teamFeed'
import { addDays, localDateString } from '@/shared/lib/dates'

/** A fal két hetet mutat — az esti kiadásokat is ennyire kérjük le (mezo-a9bo7.13). */
const WALL_DAYS = 14

/**
 * A csapat poszt-folyama a meglévő hookokból (mezo-a9bo7.8/.9) — a fal és a szobák EGY forrása.
 * `loading` a betöltés-kapu: az üres-állapot előtt kell vizsgálni (mezo-yew), különben félkész
 * adatból villan fel a „csend van”.
 *
 * Két kimenet (mezo-a9bo7.13): a **`feed`** a FAL — a kiadás-napokon az esti kiadás válogatása —,
 * a **`rooms`** pedig a teljes rekordkészlet, mert ami a kiadásba nem került be, az a karakter
 * szobájában marad (spec 2026-09-24 §2).
 */
export function useTeamFeed() {
  const patterns = usePatterns()
  const monitor = usePatternMonitor()
  const predictions = usePredictions()
  const experiments = useExperiments()
  const observations = useObservations()
  const characterFeed = useCharacterFeed(60)
  const today = localDateString()
  const editions = useTeamEditions(addDays(today, -(WALL_DAYS - 1)), today)

  const loading = patterns.isPending || monitor.isPending || predictions.isPending
    || experiments.isPending || observations.isPending || characterFeed.isLoading || editions.isLoading
  const pairs = monitor.monitor?.pairs
  const rooms = useMemo(() => buildTeamFeed({
    patterns: patterns.patterns,
    monitorPairs: pairs ?? [],
    predictions: predictions.predictions,
    experiments: experiments.experiments,
    observations: observations.observations,
    characterItems: characterFeed.items,
    today,
  }), [patterns.patterns, pairs, predictions.predictions, experiments.experiments,
    observations.observations, characterFeed.items, today])
  const feed = useMemo(() => mergeWall(rooms, editions.editions, today), [rooms, editions.editions, today])

  return {
    feed,
    rooms,
    today,
    loading,
    degraded: patterns.degraded || observations.degraded,
    patterns: patterns.patterns,
    pairs: pairs ?? [],
  }
}
