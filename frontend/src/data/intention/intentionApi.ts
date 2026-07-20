import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { IntentionDay, IntentionFocus, Reflection } from '@/data/types'

type DayWire = paths['/api/intention/day/{date}']['get']['responses']['200']['content']['application/json']
type FocusWire = DayWire['foci'][number]

export function toDay(w: DayWire): IntentionDay {
  return {
    date: w.date,
    creed: w.creed ?? null,
    foci: (w.foci ?? []).map(toFocus),
    reflection: (w.reflection ?? null) as Reflection | null,
    focusCap: w.focusCap,
  }
}
function toFocus(w: FocusWire): IntentionFocus {
  return { id: w.id, focusDate: w.focusDate, text: w.text }
}

export const intentionApi = {
  day: (date: string) => apiFetch<DayWire>(`/api/intention/day/${date}`).then(toDay),
  setCreed: (text: string) =>
    apiFetch(`/api/intention/creed`, { method: 'PUT', body: JSON.stringify({ text }) }),
  addFocus: (date: string, text: string) =>
    apiFetch(`/api/intention/focus`, { method: 'POST', body: JSON.stringify({ date, text }) }),
  removeFocus: (id: string) => apiFetch(`/api/intention/focus/${id}`, { method: 'DELETE' }),
  reflect: (date: string, value: Reflection) =>
    apiFetch(`/api/intention/reflect`, { method: 'POST', body: JSON.stringify({ date, value }) }),
}
