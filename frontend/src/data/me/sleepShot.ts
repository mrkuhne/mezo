import type { SleepShotDraft } from '@/data/types'

// The canonical Sleep Cycle example screenshot (spec Global Constraints): all checks pass.
export const MOCK_SLEEP_SHOT_DRAFT: SleepShotDraft = {
  bedtime: '00:42',
  wakeup: '09:03',
  durationH: 7.48,
  inBedMin: 501,
  awakeMin: 52,
  lightMin: 206,
  remMin: 144,
  deepMin: 100,
  sourceQualityPct: 95,
  // 34 buckets x 15 min = 510 min, within tolerance of the 501-minute 00:42 -> 09:03 span.
  hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' },
  confidence: 1,
  needsReview: false,
}
