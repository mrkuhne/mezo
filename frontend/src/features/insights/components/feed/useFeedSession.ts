import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeedPost, SessionAfterlife } from '@/features/insights/logic/teamFeed'

/**
 * A fal munkamenet-állapota (mezo-a9bo7.8): a most hozott döntések utóélete és a könnyű
 * visszajelzések. A hitelesített query-cache-ben él (kijelentkezéskor törlődik), mint a
 * `useCharacterReplyDraft` vázlata — így túléli, ha egy poszt a döntés után átrendeződik vagy
 * a folyamból kiesik (a pillanatképe a helyén marad, `withSessionAfterlife`).
 */
export type FeedVote = 'up' | 'down'

export interface FeedSessionState {
  afterlife: Record<string, SessionAfterlife>
  votes: Record<string, FeedVote>
}

const KEY = ['team-feed-session']
const EMPTY: FeedSessionState = { afterlife: {}, votes: {} }

export function useFeedSession() {
  const qc = useQueryClient()
  const { data = EMPTY } = useQuery({
    queryKey: KEY,
    queryFn: async () => EMPTY,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const update = (fn: (s: FeedSessionState) => FeedSessionState) =>
    qc.setQueryData<FeedSessionState>(KEY, current => fn(current ?? EMPTY))
  return {
    ...data,
    settle: (post: FeedPost, label: string) =>
      update(s => ({ ...s, afterlife: { ...s.afterlife, [post.id]: { label, snapshot: post } } })),
    /** Könnyű visszajelzés: ugyanarra a gombra kattintva visszavonható. */
    toggleVote: (postId: string, vote: FeedVote) =>
      update(s => {
        const votes = { ...s.votes }
        if (votes[postId] === vote) delete votes[postId]
        else votes[postId] = vote
        return { ...s, votes }
      }),
  }
}
