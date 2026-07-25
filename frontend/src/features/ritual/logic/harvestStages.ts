export interface HarvestStage { kind: 'xp-total' | 'source' | 'coin' | 'skill' | 'streak'; delayMs: number }

/**
 * The Napzárás Harvest act's reward-choreography order + delays (R3, mezo-ilsj §4 act 4) — pure,
 * no timers/animation here, just the schedule a component staggers its `CountUp`/pop-ins against.
 *
 * Fixed cadence: `xp-total` lands first at 400ms; each per-source chip follows +250ms after the
 * previous beat; the coin run starts 300ms after the LAST beat before it (a source if there is
 * one, else xp-total) then steps +250ms per coin; an optional skill-bar highlight follows +400ms
 * after the last beat before it; the streak flame always closes the sequence +400ms after
 * whatever came before (skill if present, else coins, else sources, else xp-total alone).
 */
export function harvestStages(input: { sources: number; coins: number; hasSkillHighlight: boolean }): HarvestStage[] {
  const stages: HarvestStage[] = []
  let t = 400
  stages.push({ kind: 'xp-total', delayMs: t })

  for (let i = 0; i < input.sources; i++) {
    t += 250
    stages.push({ kind: 'source', delayMs: t })
  }

  if (input.coins > 0) {
    t += 300
    for (let i = 0; i < input.coins; i++) {
      if (i > 0) t += 250
      stages.push({ kind: 'coin', delayMs: t })
    }
  }

  if (input.hasSkillHighlight) {
    t += 400
    stages.push({ kind: 'skill', delayMs: t })
  }

  t += 400
  stages.push({ kind: 'streak', delayMs: t })

  return stages
}
