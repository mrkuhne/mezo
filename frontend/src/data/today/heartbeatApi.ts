import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { CompanionNote } from '@/data/types'

type HeartbeatWire =
  paths['/api/proactive/heartbeat']['get']['responses']['200']['content']['application/json']

/** Wire → FE CompanionNote: window/kind pass through, content becomes text. */
export function toCompanionNote(wire: HeartbeatWire): CompanionNote {
  return { window: wire.window, kind: wire.kind as CompanionNote['kind'], text: wire.content }
}

export const heartbeatApi = {
  /** The day's latest heartbeat note for the FE's LOCAL day (the briefing date precedent). */
  get: (date: string) =>
    apiFetch<HeartbeatWire>(`/api/proactive/heartbeat?date=${date}`).then(toCompanionNote),
}
