import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { TutorialProgress } from '@/data/types'

type TutorialProgressResponse = components['schemas']['TutorialProgressResponse']
type SetTutorialProgressRequest = components['schemas']['SetTutorialProgressRequest']

// The generated schema marks completedAt/dismissedAtStep optional (`?`) since the wire format
// omits absent fields, but TutorialProgress (our domain type) always carries them, explicitly
// null when unset — normalize instead of casting so a missing field can't slip through as `undefined`.
function normalizeProgress(raw: TutorialProgressResponse['progress']): TutorialProgress {
  const out: TutorialProgress = {}
  for (const [id, e] of Object.entries(raw)) {
    out[id] = { version: e.version, seenAt: e.seenAt, completedAt: e.completedAt ?? null, dismissedAtStep: e.dismissedAtStep ?? null }
  }
  return out
}

export const tutorialProgressApi = {
  get: (): Promise<TutorialProgress> =>
    apiFetch<TutorialProgressResponse>('/api/tutorial/progress').then((r) => normalizeProgress(r.progress)),
  set: (progress: TutorialProgress): Promise<TutorialProgress> =>
    apiFetch<TutorialProgressResponse>('/api/tutorial/progress', {
      method: 'PUT',
      body: JSON.stringify({ progress } satisfies SetTutorialProgressRequest),
    }).then((r) => normalizeProgress(r.progress)),
  reset: (): Promise<void> => apiFetch<void>('/api/tutorial/progress', { method: 'DELETE' }),
}
