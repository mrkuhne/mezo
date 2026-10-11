import type { Shape } from '../shape'
import type { frameHu } from './frame.hu'

export const frameEn: Shape<typeof frameHu> = {
  crash: { title: 'Something went wrong.', reload: 'Reload' },
  loading: 'Loading…',
}
