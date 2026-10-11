// Mezo · the question after „Szett hozzáadása": only today, or every week (the plan row gets one more working set).
// Moved out of pages/ActiveWorkoutPage.tsx unchanged (mezo-n4wf5.4 foundation). Closing it without a choice = only today.
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'

export function ExtraSetPrompt({ onEveryWeek, onClose }: { onEveryWeek: () => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="add-set-prompt-title" className="sheet-nested glass wos-sheet">
      {(close) => (
        <>
          {/* U4: a floating coral glass sheet — the prototype's `extra` sheet. */}
          <div className="wos-sheet-head">
            <Icon3D name="t-weight" size={52} className="wos-sheet-art3d" />
            <span className="wos-sheet-title">
              <span className="wos-sheet-eb">Extra szett hozzáadva</span>
              <h3 id="add-set-prompt-title">A tervbe is felvegyük?</h3>
            </span>
          </div>
          <p className="wos-sheet-lead">
            Csak erre az alkalomra szól, vagy minden hétre — ilyenkor a mesociklus terve is eggyel több szettet ír elő ennél a gyakorlatnál.
          </p>
          <div className="wos-sheet-two">
            <button
              type="button"
              className="wos-primary"
              onClick={() => {
                onEveryWeek()
                close()
              }}
            >
              Minden hétre
            </button>
            <button type="button" className="wos-pill is-block" onClick={close}>
              Csak ma
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
