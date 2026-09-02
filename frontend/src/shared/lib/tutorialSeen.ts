// ============================================================
// Mezo · tutorialSeen — a kalauz seen-store localStorage-tükre (mezo-gb1s.1).
// A backend (`useTutorialProgress`) az igazság forrása; ez a tükör két dolgot ad:
// azonnali elrejtést (a PUT visszaérkezése előtt) és offline/hiba-esetre a legutóbbi
// ismert állapotot. Ugyanaz a defenzív try/catch-idióma, mint `seenMessages.ts`.
// ============================================================
import type { TutorialProgress } from '@/data/types'

export const TUTORIAL_SEEN_KEY = 'mezo.kalauz.v1'

export function readLocalProgress(): TutorialProgress {
  try {
    const raw = localStorage.getItem(TUTORIAL_SEEN_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as TutorialProgress) : {}
  } catch {
    return {}
  }
}

export function writeLocalProgress(progress: TutorialProgress): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, JSON.stringify(progress))
  } catch {
    /* ignore — a tükör kényelem, nem igazság */
  }
}

/** Unió; kulcsonként a KÉSŐBBI seenAt nyer, döntetlennél a lokális (az optimistán frissebb). */
export function mergeProgress(server: TutorialProgress, local: TutorialProgress): TutorialProgress {
  const out: TutorialProgress = { ...server }
  for (const [id, entry] of Object.entries(local)) {
    const s = out[id]
    if (!s || Date.parse(entry.seenAt) >= Date.parse(s.seenAt)) out[id] = entry
  }
  return out
}
