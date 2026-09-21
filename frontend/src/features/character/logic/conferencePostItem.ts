import type { CharacterConferenceResponse, CharacterReplySource } from '@/data/character/characterApi'

/** Only stored dialogue belongs in a social thread; legacy prose is not reconstructed here. */
export function conferencePostItem(conference: CharacterConferenceResponse | null | undefined, source: CharacterReplySource) {
  if (conference?.deliberationSource !== 'STORED') return undefined
  const items = conference.deliberation?.flatMap(thread => thread.items)
  if (source.sourceType === 'CONFERENCE_ITEM') return items?.find(item => item.index === source.sourceIndex)
  if (source.sourceType !== 'CONFERENCE_CHANGE') return undefined
  const claimId = conference.changes[source.sourceIndex]?.claimId
  return claimId ? items?.find(item => item.claimId === claimId) : undefined
}
