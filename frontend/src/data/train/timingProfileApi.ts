import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type TimingProfileResponse = components['schemas']['TimingProfileResponse']

/** The calibrated pacing read (`GET /api/train/timing-profile`, Task 11). All five top-level
 *  fields are always present — unlearned components come back as the static config seeds
 *  (480 / 180 / 125 / 240), with `samples` at 0 for those. No cold-start branch on the client. */
export const timingProfileApi = {
  get: (): Promise<TimingProfileResponse> => apiFetch<TimingProfileResponse>('/api/train/timing-profile'),
}
