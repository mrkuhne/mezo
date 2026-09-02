import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutineWizardPage } from '@/features/me/pages/RoutineWizardPage'
import type { HabitChainInfo } from '@/data/types'

const { useHabitCatalog, useHabitCatalogActions, createDef, updateDef, navigate } = vi.hoisted(() => ({
  useHabitCatalog: vi.fn(), useHabitCatalogActions: vi.fn(),
  createDef: vi.fn((_input: Record<string, unknown>) => Promise.resolve()),
  updateDef: vi.fn((_id: string, _input: Record<string, unknown>) => Promise.resolve()),
  navigate: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
  useProgressionProfile: () => ({ data: { life: [] } }),
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const MORNING: HabitChainInfo = {
  id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
  position: 1, isActive: true,
  defs: [{
    id: 'd1', habitKey: 'sun', chainKey: 'MORNING', position: 1, title: 'Reggeli fény',
    why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
    xp: 5, linkUrl: null, isActive: true, framework: null, anchorHabitKey: null,
    cue: null, craving: null, reward: null, celebration: null, identity: null,
  }, {
    id: 'd2', habitKey: 'intent', chainKey: 'MORNING', position: 2, title: 'Napi szándék leírása',
    why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindfulness',
    xp: 10, linkUrl: null, isActive: true, framework: 'CLEAR', anchorHabitKey: null,
    cue: '7:10-kor a konyhaasztalnál', craving: 'tisztább fejjel indul a nap',
    reward: 'a pipa maga', celebration: null, identity: 'figyel a saját gondolataira',
  }, {
    // A FOGG def whose anchor is a real LINK to `sun` — the only shape that can exercise
    // unlinking (`anchorHabitKey: ''`), which is what "Keret váltása" exists to make possible.
    id: 'd3', habitKey: 'stack', chainKey: 'MORNING', position: 3, title: 'Egy oldal olvasás',
    why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
    xp: 5, linkUrl: null, isActive: true, framework: 'FOGG', anchorHabitKey: 'sun',
    cue: null, craving: null, reward: null, celebration: 'ökölrázás', identity: null,
  }],
}

const EVENING: HabitChainInfo = {
  id: 'c2', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING',
  position: 2, isActive: true, defs: [],
}

beforeEach(() => {
  useHabitCatalog.mockReturnValue({ catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: false, refetch: vi.fn() })
  useHabitCatalogActions.mockReturnValue({ createDef, updateDef, pending: false })
  createDef.mockClear()
  createDef.mockImplementation(() => Promise.resolve())
  updateDef.mockClear()
  navigate.mockClear()
  sessionStorage.clear()
})

const renderWizard = (path = '/me/rutin/uj') =>
  render(<MemoryRouter initialEntries={[path]}><RoutineWizardPage /></MemoryRouter>)
const next = () => screen.getByRole('button', { name: /Tovább|Mentés/ })

describe('RoutineWizardPage', () => {
  it('blocks step 1 until a framework is chosen', () => {
    renderWizard()
    expect(next()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    expect(next()).toBeEnabled()
  })

  it('assembles the Fogg sentence as the blanks fill and saves the recipe', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())

    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    expect(screen.getByTestId('recipe-sentence')).toHaveTextContent('Miután kész a Reggeli fény')
    fireEvent.click(next())

    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())

    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    expect(next()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    expect(next()).toBeEnabled()
    fireEvent.click(next())

    // EXACT, not objectContaining: the backend rejects a FOGG recipe that carries BOTH
    // anchorHabitKey and anchorCopy, and objectContaining would happily pass that payload.
    expect(createDef).toHaveBeenCalledWith({
      chainKey: 'MORNING', title: 'leírok egy mondatot', mode: 'MANUAL',
      skillKey: 'mindset', xp: 10,
      framework: 'FOGG', anchorHabitKey: 'sun', celebration: 'ökölrázás',
    })
    expect(createDef).toHaveBeenCalledWith(expect.not.objectContaining({ anchorCopy: expect.anything() }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/me/rutin'))
  })

  it('sends a free-text Fogg anchor as anchorCopy, never alongside anchorHabitKey', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Horgony'), { target: { value: 'letettem a fogkefét' } })
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    expect(createDef).toHaveBeenCalledWith({
      chainKey: 'MORNING', title: 'leírok egy mondatot', mode: 'MANUAL',
      skillKey: 'mindset', xp: 10,
      framework: 'FOGG', anchorCopy: 'letettem a fogkefét', celebration: 'ökölrázás',
    })
  })

  it('saves a Clear recipe with no anchor fields and no blank identity', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Jelzés'), { target: { value: '7:10-kor a konyhában' } })
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Válasz'), { target: { value: 'leírom a szándékot' } })
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: 'tisztább a fejem' } })
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    // Backend rules: a CLEAR recipe must carry NO anchor fields, and an untouched identity is
    // omitted outright rather than sent as ''.
    expect(createDef).toHaveBeenCalledWith({
      chainKey: 'MORNING', title: 'leírom a szándékot', mode: 'MANUAL',
      skillKey: 'mindset', xp: 10, framework: 'CLEAR',
      cue: '7:10-kor a konyhában', craving: 'tisztább a fejem', reward: 'a pipa maga',
    })
    const payload = createDef.mock.calls[0][0]
    expect(payload).not.toHaveProperty('anchorHabitKey')
    expect(payload).not.toHaveProperty('anchorCopy')
    expect(payload).not.toHaveProperty('identity')
  })

  it('seeds the form from ?prefill', () => {
    renderWizard('/me/rutin/uj?prefill=intent')
    expect(screen.getByRole('button', { name: /Négy törvény/ })).toHaveClass('on')
    fireEvent.click(next())
    expect(screen.getByLabelText('Jelzés')).toHaveValue('7:10-kor a konyhaasztalnál')
    fireEvent.click(next())
    expect(screen.getByLabelText('Válasz')).toHaveValue('Napi szándék leírása')
    expect(screen.getByLabelText('Vágy')).toHaveValue('tisztább fejjel indul a nap')
    expect(screen.getByLabelText('Identitás')).toHaveValue('figyel a saját gondolataira')
    expect(screen.getByRole('button', { name: 'Reggeli rutin' })).toHaveClass('on')
  })

  it('keeps the anchor habit link across a Fogg → Clear → Fogg round trip', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    fireEvent.click(screen.getByRole('button', { name: '← Vissza' }))

    // Away to Clear and back. anchorLabel survives the round trip, so the chip still reads as
    // selected — the resolved habitKey behind it must survive too, or the payload silently
    // downgrades a real habit link to anchorCopy free text.
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    expect(screen.getByRole('button', { name: 'kész a Reggeli fény' })).toHaveClass('on')
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    expect(createDef).toHaveBeenCalledWith({
      chainKey: 'MORNING', title: 'leírok egy mondatot', mode: 'MANUAL',
      skillKey: 'mindset', xp: 10,
      framework: 'FOGG', anchorHabitKey: 'sun', celebration: 'ökölrázás',
    })
    expect(createDef).toHaveBeenCalledWith(expect.not.objectContaining({ anchorCopy: expect.anything() }))
  })

  it('drops the commitment tick when the framework changes', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    expect(next()).toBeEnabled()

    // back to step 1 and switch frameworks — the tick was a promise about the Fogg sentence
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '← Vissza' }))
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Jelzés'), { target: { value: '7:10-kor a konyhában' } })
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Válasz'), { target: { value: 'leírom a szándékot' } })
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: 'tisztább a fejem' } })
    fireEvent.click(next())
    // reward defaults to "a pipa maga", so ONLY a carried-over tick could unlock this step
    expect(next()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    expect(next()).toBeEnabled()
  })

  it('requires craving on the Clear branch before leaving step 3', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Jelzés'), { target: { value: '7:10-kor a konyhában' } })
    fireEvent.click(next())
    // The prototype's `titleLb` names the Clear slot "válasz", not the sentence module's "tett".
    expect(screen.getByText('Én … · válasz')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Válasz'), { target: { value: 'leírom a szándékot' } })
    expect(next()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: 'tisztább a fejem' } })
    expect(next()).toBeEnabled()
  })

  // --- A · re-framing CONVERTS the definition it was opened with (mezo-3zue.4) -------------
  it('converts the prefilled def instead of duplicating it, and keeps the FOGG/CLEAR shape honest', async () => {
    // `intent` is a CLEAR def; switching it to FOGG must PATCH d2, never create a second habit.
    renderWizard('/me/rutin/uj?prefill=intent')
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Horgony'), { target: { value: 'letettem a fogkefét' } })
    fireEvent.click(next())
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    expect(createDef).not.toHaveBeenCalled()
    // EXACT: `updateDef` accepts no mode/skillKey, a bare chainKey would be read as a MOVE (the
    // chain is unchanged here, so it must be absent), and the CLEAR fields are left for the
    // backend to clear — sending them alongside a FOGG anchor is what the validator rejects.
    expect(updateDef).toHaveBeenCalledWith('d2', {
      title: 'Napi szándék leírása', xp: 10, framework: 'FOGG',
      anchorCopy: 'letettem a fogkefét', celebration: 'ökölrázás',
    })
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/me/rutin?new=intent'))
  })

  it('omits chainKey on the convert path when the habit stayed in its chain', () => {
    renderWizard('/me/rutin/uj?prefill=intent&chain=MORNING')
    fireEvent.click(next())
    fireEvent.click(next())
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    // A bare chainKey is a MOVE server-side: re-sending the CURRENT chain on a copy fix would
    // silently re-order the habit to the end of its own chain.
    expect(updateDef.mock.calls[0][1]).not.toHaveProperty('chainKey')
  })

  it('sends chainKey on the convert path when the habit really moved chain', () => {
    renderWizard('/me/rutin/uj?prefill=intent')
    fireEvent.click(next())
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'Esti rutin' }))
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    expect(updateDef.mock.calls[0][1]).toMatchObject({ chainKey: 'EVENING' })
  })

  it('unlinks a chip anchor explicitly when the user types free text over it', async () => {
    // `stack` is anchored to the `sun` habit by KEY. Typing over that anchor must send
    // anchorHabitKey: '' — an omission leaves the stale link (the PATCH guard is `!= null`) and
    // `recipeFromDef` prefers the link over the copy, so the typed anchor would vanish silently.
    // This is exactly the escape hatch HabitPage's read-only anchor field sends the user here for.
    renderWizard('/me/rutin/uj?prefill=stack')
    fireEvent.click(next())
    expect(screen.getByLabelText('Horgony')).toHaveValue('kész a Reggeli fény')
    fireEvent.change(screen.getByLabelText('Horgony'), { target: { value: 'letettem a fogkefét' } })
    fireEvent.click(next())
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    expect(updateDef).toHaveBeenCalledWith('d3', {
      title: 'Egy oldal olvasás', xp: 5, framework: 'FOGG',
      anchorCopy: 'letettem a fogkefét', anchorHabitKey: '', celebration: 'ökölrázás',
    })
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/me/rutin?new=stack'))
  })

  it('keeps the link — and sends no unlink — when a chip anchor is left alone', () => {
    renderWizard('/me/rutin/uj?prefill=stack')
    fireEvent.click(next())
    fireEvent.click(next())
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    expect(updateDef).toHaveBeenCalledWith('d3', {
      title: 'Egy oldal olvasás', xp: 5, framework: 'FOGG',
      anchorHabitKey: 'sun', celebration: 'ökölrázás',
    })
    expect(updateDef.mock.calls[0][1]).not.toHaveProperty('anchorCopy')
  })

  // --- B · an accepted AI suggestion seeds the wizard, and prefill outranks it ---------------
  it('seeds from the stashed AI suggestion and consumes it so a reload cannot resurrect it', () => {
    sessionStorage.setItem('mezo.routineWizard.suggestion', JSON.stringify({
      title: 'Esti telefon-lezárás', why: 'Gyorsabb elalvás.', anchorCopy: 'wind-down előtt',
      skillKey: 'recovery', xp: 10, chainKey: 'MORNING', framework: 'FOGG',
      cue: null, craving: null, reward: null, celebration: 'egy elégedett bólintás',
    }))
    renderWizard('/me/rutin/uj?chain=MORNING')

    expect(sessionStorage.getItem('mezo.routineWizard.suggestion')).toBeNull()
    expect(screen.getByRole('button', { name: /Szokás-láncolás/ })).toHaveClass('on')
    fireEvent.click(next())
    expect(screen.getByLabelText('Horgony')).toHaveValue('wind-down előtt')
    fireEvent.click(next())
    expect(screen.getByLabelText('Pici tett')).toHaveValue('Esti telefon-lezárás')
    fireEvent.click(next())
    expect(screen.getByLabelText('Ünneplés')).toHaveValue('egy elégedett bólintás')
  })

  it('still seeds the suggestion under StrictMode, which double-invokes the state initializer', () => {
    // The app mounts in StrictMode (main.tsx), so React dev-invokes every lazy useState
    // initializer TWICE. Measured on React 19.2.7: both calls run, but React commits the FIRST
    // one's result — so the old consume-inside-the-initializer version did NOT actually lose the
    // suggestion, and this test passes against it too. It is a guard, not a reproduction: the
    // initializer is pure now (the mount effect consumes the key), so seeding no longer rests on
    // which invocation React happens to keep.
    sessionStorage.setItem('mezo.routineWizard.suggestion', JSON.stringify({
      title: 'Esti telefon-lezárás', why: 'x', anchorCopy: 'wind-down előtt',
      skillKey: 'recovery', xp: 10, chainKey: 'MORNING', framework: 'FOGG',
      cue: null, craving: null, reward: null, celebration: 'egy elégedett bólintás',
    }))
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/me/rutin/uj?chain=MORNING']}><RoutineWizardPage /></MemoryRouter>
      </StrictMode>,
    )

    expect(screen.getByRole('button', { name: /Szokás-láncolás/ })).toHaveClass('on')
    fireEvent.click(next())
    expect(screen.getByLabelText('Horgony')).toHaveValue('wind-down előtt')
    // still consumed, so a reload cannot resurrect it
    expect(sessionStorage.getItem('mezo.routineWizard.suggestion')).toBeNull()
  })

  it('lets ?prefill win over a stashed suggestion for every field both could fill', () => {
    sessionStorage.setItem('mezo.routineWizard.suggestion', JSON.stringify({
      title: 'Esti telefon-lezárás', why: 'x', anchorCopy: 'wind-down előtt',
      skillKey: 'recovery', xp: 5, chainKey: 'EVENING', framework: 'FOGG',
      cue: 'este a nappaliban', craving: 'nyugodtabb elalvás', reward: 'egy fejezet',
      celebration: 'bólintás',
    }))
    renderWizard('/me/rutin/uj?prefill=intent')

    // The def is CLEAR; the suggestion proposed FOGG. The user came here to re-frame ONE habit.
    expect(screen.getByRole('button', { name: /Négy törvény/ })).toHaveClass('on')
    fireEvent.click(next())
    expect(screen.getByLabelText('Jelzés')).toHaveValue('7:10-kor a konyhaasztalnál')
    fireEvent.click(next())
    expect(screen.getByLabelText('Válasz')).toHaveValue('Napi szándék leírása')
  })

  it('a malformed stash never breaks the page — the wizard just opens empty', () => {
    sessionStorage.setItem('mezo.routineWizard.suggestion', '{nem json')
    renderWizard()
    expect(next()).toBeDisabled()
    expect(sessionStorage.getItem('mezo.routineWizard.suggestion')).toBeNull()
  })

  it('falls back to CREATE when ?prefill names a habitKey the catalog does not have', () => {
    renderWizard('/me/rutin/uj?prefill=nincs-ilyen')
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Horgony'), { target: { value: 'letettem a fogkefét' } })
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    // The load-bearing half is `updateDef` NOT being called: an unknown key must degrade to a
    // create, not throw and not PATCH some other definition.
    expect(updateDef).not.toHaveBeenCalled()
    expect(createDef).toHaveBeenCalledTimes(1)
  })

  // --- C · the hub highlights the row the wizard just made ----------------------------------
  it('returns to the hub with ?new=<habitKey> of the created def', async () => {
    createDef.mockImplementation(() => Promise.resolve({ habitKey: 'custom_ab12' } as never))
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Horgony'), { target: { value: 'letettem a fogkefét' } })
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    fireEvent.click(next())

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/me/rutin?new=custom_ab12'))
  })

  it('warns softly when the Fogg behaviour looks too big, without blocking', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), {
      target: { value: 'lefutok tizenöt kilométert a hegyen minden egyes reggel' },
    })
    expect(screen.getByText(/nagynak hangzik/)).toBeInTheDocument()
    expect(next()).toBeEnabled()
  })
})
