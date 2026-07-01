import { apiFetch } from '@/lib/api'
import type { components } from '@/lib/api.gen'

// Contract types generated from api/openapi.yml (Progression P4) — no regen needed.
export type ProgressionProfileResponse = components['schemas']['ProgressionProfileResponse']
export type SkillLevel = components['schemas']['SkillLevel']
export type RadarAxis = components['schemas']['RadarAxis']
export type ProfileHighlights = components['schemas']['ProfileHighlights']
export type SkillRef = components['schemas']['SkillRef']

export const progressionApi = {
  getProfile: (): Promise<ProgressionProfileResponse> =>
    apiFetch<ProgressionProfileResponse>('/api/progression/profile'),
}
