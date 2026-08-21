import type { ArtifactFeedback } from '@/data/feedback/feedbackTypes'

/**
 * Mock seed — deliberately EMPTY, and that is the honest seed, not a stub.
 *
 * Feedback is something the USER produces; nothing in the Phase-1 demo data has been voted on,
 * so pre-seeding thumbs would fake a history the demo never had (and would light up chips the
 * user never tapped). Mock-mode votes are written straight into the TanStack query cache by
 * `useFeedback` and accumulate there for the session — reload resets them, exactly like every
 * other mock-mode write.
 */
export const mockFeedback: ArtifactFeedback[] = []
