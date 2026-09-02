import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutineWizardPage } from '@/features/me/pages/RoutineWizardPage'
import type { HabitChainInfo } from '@/data/types'

const { useHabitCatalog, useHabitCatalogActions, createDef, navigate } = vi.hoisted(() => ({
  useHabitCatalog: vi.fn(), useHabitCatalogActions: vi.fn(),
  createDef: vi.fn((_input: Record<string, unknown>) => Promise.resolve()), navigate: vi.fn(),
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
  }],
}

beforeEach(() => {
  useHabitCatalog.mockReturnValue({ catalog: { chains: [MORNING] }, isPending: false, isError: false, refetch: vi.fn() })
  useHabitCatalogActions.mockReturnValue({ createDef, pending: false })
  createDef.mockClear()
  navigate.mockClear()
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
