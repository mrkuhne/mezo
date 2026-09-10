// ============================================================
// Mezo · QuickInputSheet — a Design 2.0 quick-log launcher (mezo-7lst)
// A floating coral FAB mögött, minden tabon. Thin `Sheet` wrapper: the grid + phase
// logic moved to `QuickLogSurface` (mezo-mhum) so the SAME surface can also host the
// full-page Titanium picker at /nap/gyors.
// ============================================================
import { QuickLogSurface } from '@/features/quickinput/QuickLogSurface'

export function QuickInputSheet({ onClose }: { onClose: () => void }) {
  return <QuickLogSurface variant="sheet" onDone={onClose} />
}
