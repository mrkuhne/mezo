// ============================================================
// Mezo · runToTemplate (mezo-tlwa) — the pure "save this run as a template"
// mapping behind both run→template entry points (MesoReportPage's CTA and a
// Történet card's `Sablonná` action). A run and a template describe the SAME
// plan document in two different shapes, so this is a field-for-field copy plus
// two deliberate reductions:
//
//  · **days** go through the shared `toDayInputs` — every day travels (rest days
//    included, `muscle: ''`/`exercises: []`), exercise ids dropped since the
//    server regenerates them on each write.
//  · **volumePerMuscle** collapses each run-side `VolumeProfile` onto its
//    provenance BASELINE (`profile.source.baseline`), which is the only part a
//    template can carry (`Record<string, VolumeBaseline>`). The profile's live
//    `mev/mav/mrv/current` are the *outcome* of that run's adjustments +
//    weekly ramp — copying them would freeze one run's fatigue state into a
//    reusable blueprint. A muscle whose baseline cannot be resolved (a partial
//    payload) is SKIPPED rather than invented; nothing resolvable ⇒ `null`.
//
// The title gets a `— sablon` suffix so the new row is recognizable in the
// Sablonok list; no dedupe suffix (the backend allows duplicate titles, and the
// caller lands in the editor where renaming is one tap away).
// ============================================================
import type { Mesocycle, VolumeBaseline, VolumeProfile } from '@/data/types'
import type { MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import { toDayInputs } from '@/features/train/logic/mesoDays'

/** The provenance baseline of a profile, or null when the payload carries none. */
function baselineOf(profile: VolumeProfile): VolumeBaseline | null {
  const b: VolumeBaseline | undefined = profile?.source?.baseline
  return b ? { name: b.name, mev: b.mev, mav: b.mav, mrv: b.mrv } : null
}

function toBaselines(
  volumePerMuscle: Mesocycle['volumePerMuscle'],
): Record<string, VolumeBaseline> | null {
  const out: Record<string, VolumeBaseline> = {}
  for (const [muscle, profile] of Object.entries(volumePerMuscle ?? {})) {
    const baseline = baselineOf(profile)
    if (baseline) out[muscle] = baseline
  }
  return Object.keys(out).length > 0 ? out : null
}

/** A closed (or any) run → the upsert body that recreates its plan as a template. */
export function runToTemplate(meso: Mesocycle): MesoTemplateUpsertRequest {
  return {
    title: `${meso.title} — sablon`,
    // The run's own optional fields are non-nullable strings in the domain type but the
    // template contract is nullable — an empty string is "not set", not a value.
    shortTitle: meso.shortTitle || null,
    goal: meso.goal || null,
    goalPreset: meso.goalPreset ?? null,
    musclePriorities: meso.musclePriorities ?? null,
    weeks: meso.weeks,
    split: meso.split || null,
    style: meso.style || null,
    phaseCurve: meso.phaseCurve,
    notes: meso.notes ?? null,
    volumePerMuscle: toBaselines(meso.volumePerMuscle),
    days: toDayInputs(meso.days ?? []),
  }
}
