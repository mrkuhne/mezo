import type { Shape } from '../shape'
import type { kitHu } from './kit.hu'

export const kitEn: Shape<typeof kitHu> = {
  back: 'Back',
  close: 'Close',
  cancel: 'Cancel',
  loading: 'Loading…',
  retry: 'Retry',
  clearSearch: 'Clear search',
  decrease: (who) => `Decrease ${who}`,
  increase: (who) => `Increase ${who}`,
  members: { szunya: 'Sleep', mocor: 'Movement', falat: 'Food', deru: 'Mood', mezo: 'Mezo', szk: 'Skeptic' },
  memberMeta: { szunya: 'rest', mocor: 'load', falat: 'diet', deru: 'mood', mezo: 'the whole picture' },
}
