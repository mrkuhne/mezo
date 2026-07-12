import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { Achievements } from '@/data/types'

// Contract types generated from api/openapi.yml (Progression P4) — no regen needed.
export type ProgressionProfileResponse = components['schemas']['ProgressionProfileResponse']
export type SkillLevel = components['schemas']['SkillLevel']
export type RadarAxis = components['schemas']['RadarAxis']
export type ProfileHighlights = components['schemas']['ProfileHighlights']
export type SkillRef = components['schemas']['SkillRef']
// Achievements (Growth page, mezo-rmhr) — the wire pieces are 1:1 with the hand types.
export type AchievementsResponse = components['schemas']['AchievementsResponse']
export type BadgeResponse = components['schemas']['BadgeResponse']
export type PerkUnlockResponse = components['schemas']['PerkUnlockResponse']

function toAchievements(w: AchievementsResponse): Achievements {
  return {
    badges: w.badges.map((b) => ({ ...b })),
    perks: w.perks.map((p) => ({ ...p })),
  }
}

export const progressionApi = {
  getProfile: (): Promise<ProgressionProfileResponse> =>
    apiFetch<ProgressionProfileResponse>('/api/progression/profile'),
  getAchievements: (): Promise<Achievements> =>
    apiFetch<AchievementsResponse>('/api/progression/achievements').then(toAchievements),
}
