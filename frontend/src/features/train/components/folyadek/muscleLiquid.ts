import { muscleRegion, regionColor } from '../../logic/muscleColors'

/** The muscle's own liquid: its region colour (unknown keys get the quiet ink). */
export function muscleLiquid(muscle: string): string {
  const region = muscleRegion(muscle)
  return region ? regionColor(region).rail : 'var(--fo-faint)'
}

/** The muscle colour deepened for white ground (prototype `dk()`): 74% of the colour, the rest ink. Use it for levels,
 *  capsules, pours and drops in a muscle's colour; the pale `muscleLiquid` alone is too light on white. */
export function deepMuscle(muscle: string): string {
  return `color-mix(in srgb,${muscleLiquid(muscle)} 74%,#0A2A3C)`
}
