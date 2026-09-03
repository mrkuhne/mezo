import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KalauzWelcome, type KalauzWelcomeCloseReason, type KalauzWelcomeStep } from '@/shared/ui/kalauz/KalauzWelcome'

const STEPS: KalauzWelcomeStep[] = [
  {
    kind: 'napszak', title: 'Szia, Mezo vagyok.', voice: 'Három szakasz.',
    dayparts: [
      { key: 'reggel', label: 'Reggel', spot: 's-reggel', size: 58, sub: 'rutin' },
      { key: 'nap', label: 'Nap', spot: 's-energia', size: 70, sub: 'logolás' },
      { key: 'este', label: 'Este', spot: 's-este', size: 58, sub: 'Napzárás' },
    ],
  },
  {
    kind: 'tabbar', title: 'Öt hely.', voice: 'Koppints a fülekre.',
    tabs: [
      { key: 'nap', label: 'Nap', icon: 'i-nap', voice: 'A mai nap gerince.' },
      { key: 'train', label: 'Edzés', icon: 'i-edzes', voice: 'A heti terv.' },
      { key: 'fuel', label: 'Fuel', icon: 'i-fuel', voice: 'Étkezés és keret.' },
      { key: 'mezo', label: 'Mezo', icon: 'i-mezo', voice: 'A társ.' },
      { key: 'me', label: 'Én', icon: 'i-emberek', voice: 'Te.' },
    ],
  },
  { kind: 'log', title: 'Logolni bárhonnan.', voice: 'A + gomb.', tiles: [{ label: 'Étkezés', icon: 'i-fuel' }], chat: 'Mondd el Mezónak' },
  { kind: 'sugo', title: 'Ha elakadsz.', voice: 'A ? alatt visszanézheted.' },
]

const renderWelcome = (onClose = vi.fn()) => {
  render(<KalauzWelcome steps={STEPS} onClose={onClose} />)
  return onClose
}

test('az első lépésen indul, a Vissza tiltva, a lépésszám látszik', () => {
  renderWelcome()
  expect(screen.getByRole('heading', { name: 'Szia, Mezo vagyok.' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vissza' })).toBeDisabled()
  expect(screen.getByText('Első indítás · 1 / 4')).toBeInTheDocument()
})

test('a Tovább lépteti, az utolsón Induljunk lesz belőle és done-nal zár', async () => {
  const onClose = renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByRole('heading', { name: 'Öt hely.' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  const cta = screen.getByRole('button', { name: 'Induljunk' })
  await user.click(cta)
  expect(onClose).toHaveBeenCalledWith('done', 3)
})

// APG: tartalom-nehéz dialógusnál a fókusz a CÍMRE megy, nem az első interaktív elemre —
// és lépésváltáskor ÚJRA, különben a „Tovább" képernyőolvasóval némán nem csinál semmit.
test('a fókusz mountkor és minden lépésváltáskor az aktuális címre ugrik', async () => {
  renderWelcome()
  const user = userEvent.setup()
  expect(screen.getByRole('heading', { name: 'Szia, Mezo vagyok.' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByRole('heading', { name: 'Öt hely.' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByRole('heading', { name: 'Szia, Mezo vagyok.' })).toHaveFocus()
})

test('a Kihagyom és az Escape ugyanúgy skip-pel, a lépés indexével', async () => {
  const onClose = renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledWith('skip', 1)
})

test('a Kihagyom gomb az utolsó lépésen eltűnik (ott az Induljunk a kiút)', async () => {
  renderWelcome()
  const user = userEvent.setup()
  expect(screen.getByRole('button', { name: 'Kihagyom' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.queryByRole('button', { name: 'Kihagyom' })).not.toBeInTheDocument()
})

test('a tabbar-demó a koppintott fül mondatát mutatja, és NEM navigál', async () => {
  renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByText('A mai nap gerince.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fuel' }))
  expect(screen.getByText('Étkezés és keret.')).toBeInTheDocument()
  expect(screen.queryByText('A mai nap gerince.')).not.toBeInTheDocument()
})

test('a logolás-lépés csempéi és a Mezo-sor csak koppintás után nyílnak ki', async () => {
  renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.queryByText('Mondd el Mezónak')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Gyors logolás megnyitása' }))
  expect(screen.getByText('Étkezés')).toBeInTheDocument()
  expect(screen.getByText('Mondd el Mezónak')).toBeInTheDocument()
})

test('a dialógus aria-modal, és a címe adja a nevét', () => {
  renderWelcome()
  const dlg = screen.getByRole('dialog')
  expect(dlg).toHaveAttribute('aria-modal', 'true')
  expect(dlg).toHaveAccessibleName('Szia, Mezo vagyok.')
})

// A valódi TutorialProvider-használatot modellező kis harness: a trigger ELŐSZÖR mount-ol
// (a KalauzWelcome még nincs a fában), csak utána — a triggerre adott kattintásra — nyílik ki
// a dialógus. Ez számít: a "previouslyFocused" lazy useState-inicializere a KalauzWelcome
// ELSŐ rendereléskor fut le, tehát csak akkor kapja el a triggert, ha az a dialógus mountjakor
// MÁR fókuszban van — egy közös render()-ben egyszerre mountolt trigger+dialógus ezt nem
// tesztelné. onClose lezárja a dialógust (open=false → unmount), ahogy az app is tenné.
function EscapeHarness({ onClose }: { onClose: (reason: KalauzWelcomeCloseReason, step: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Kalauz megnyitása</button>
      {open && (
        <KalauzWelcome
          steps={STEPS}
          onClose={(reason, step) => {
            setOpen(false)
            onClose(reason, step)
          }}
        />
      )}
    </div>
  )
}

// Fix round 2 (CRITICAL, a kör 1 tesztje vacuous volt): a fókusz-visszaadás a megnyitó
// triggerre megy, NEM a saját címére — a title-focus layout effect mountkor lefut, mielőtt egy
// passzív useEffect elolvashatná a document.activeElement-et, ezért a "previouslyFocused"-t az
// ELSŐ render pillanatában kell elmenteni (useState lazy init), nem egy utólagos effektben.
// A teszt a teljes életciklust végigviszi: trigger fókuszban → dialógus mount (a cím ELVESZI a
// fókuszt — ezt is ellenőrizzük) → Escape → onClose UNMOUNT-olja a dialógust → a fókusz vissza
// a triggerre. Ez a régi (kör 1 előtti) kódon MEGBUKIK — lásd a fix-jelentés RED bizonyítékát.
test('Escape-kor a dialógus lezáródik (unmount), és a fókusz visszaáll a megnyitó gombra', async () => {
  const onClose = vi.fn()
  render(<EscapeHarness onClose={onClose} />)
  const user = userEvent.setup()

  const trigger = screen.getByRole('button', { name: 'Kalauz megnyitása' })
  trigger.focus()
  expect(trigger).toHaveFocus()

  await user.click(trigger)
  // A cím ELVESZI a fókuszt mounttkor (ez a rendes APG-viselkedés) — a "previouslyFocused"
  // már el van mentve a lazy init-ben, mielőtt ez a layout effect lefut.
  expect(screen.getByRole('heading', { name: 'Szia, Mezo vagyok.' })).toHaveFocus()

  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledWith('skip', 0)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

// IMPORTANT: a `[tabindex="-1"]` cím fókusz-CÉL, nem tab-stop — ha bekerülne a focusables
// listába, Shift+Tab az első valódi tab-stopról (napszak lépésen: Kihagyom, mert a Vissza
// disabled) se a first, se a last elemet nem találná el, és a fókusz kiszökne a dialógusból.
test('Shift+Tab a napszak lépés első tab-stopjáról az utolsóra tekeredik vissza', async () => {
  renderWelcome()
  const user = userEvent.setup()
  const kihagyom = screen.getByRole('button', { name: 'Kihagyom' })
  const tovabb = screen.getByRole('button', { name: 'Tovább' })
  kihagyom.focus()
  expect(kihagyom).toHaveFocus()
  await user.tab({ shift: true })
  expect(tovabb).toHaveFocus()
})
