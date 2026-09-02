import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { TutorialProgress } from '@/data/types'

type TutorialProgressResponse = components['schemas']['TutorialProgressResponse']
type SetTutorialProgressRequest = components['schemas']['SetTutorialProgressRequest']

export const tutorialProgressApi = {
  get: (): Promise<TutorialProgress> =>
    apiFetch<TutorialProgressResponse>('/api/tutorial/progress').then((r) => r.progress as TutorialProgress),
  set: (progress: TutorialProgress): Promise<TutorialProgress> =>
    apiFetch<TutorialProgressResponse>('/api/tutorial/progress', {
      method: 'PUT',
      body: JSON.stringify({ progress } satisfies SetTutorialProgressRequest),
    }).then((r) => r.progress as TutorialProgress),
  reset: (): Promise<void> => apiFetch<void>('/api/tutorial/progress', { method: 'DELETE' }),
}
