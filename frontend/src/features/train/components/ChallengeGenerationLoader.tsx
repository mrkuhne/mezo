// ============================================================
// Mezo · ChallengeGenerationLoader (mezo-tvw8; Folyadék: mezo-n4wf5.4) — what the quest card of
// the Eligazítás says while the lazy LLM quest generation is still running. The card keeps its
// place (an entry point never hides itself): one calm box that says the quests are being put
// together and that the workout can start anyway. Completion is the data arriving and the loader
// unmounting. A polite live region, so a screen reader hears it once.
// The game-style face of the Üveg world (rotating status lines + a fake-progress bar) is retired
// with the approved prototype: a bar that only pretends to fill is not a level.
// Build target: docs/design_2.0/prototypes/vilagos/edzes.js `indulas('kuld-keszul')`.
// ============================================================
import { Box } from '@/shared/ui/folyadek'

export const CHALLENGE_LOADER_TITLE = 'Készülnek a mai küldetések…'
export const CHALLENGE_LOADER_BODY = 'A múlt heti szettjeidből rakom össze, pár pillanat. Az edzés ettől még indulhat.'

export function ChallengeGenerationLoader() {
  return (
    <div className="ei-load" role="status" aria-live="polite">
      <Box icon="t-quest" title={CHALLENGE_LOADER_TITLE}>
        <p>{CHALLENGE_LOADER_BODY}</p>
      </Box>
    </div>
  )
}
