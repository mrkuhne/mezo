import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { SportLogPage } from '@/features/train/pages/SportLogPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import type { SportSessionCreateRequest } from '@/data/train/trainApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// The page's only wire contact. Capturing the request is the point of most of these
// tests — what the form folds into it is the contract with the backend.
const logged: SportSessionCreateRequest[] = []
/** Flipped by the failure test so the mutation takes its onError branch (a real-mode 400). */
const wire = { fails: false }
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useQuickLogSport: () => ({
      sessions: [],
      logSportSession: (
        req: SportSessionCreateRequest,
        opts?: { onSuccess?: (r?: unknown) => void; onError?: (err: unknown) => void; onSettled?: () => void },
      ) => {
        logged.push(req)
        if (wire.fails) opts?.onError?.(new Error('400'))
        else opts?.onSuccess?.({ id: 'ss-1', kcal: 500, kcalIsEstimate: req.kcalOverride == null })
        opts?.onSettled?.()
      },
    }),
  }
})

beforeEach(() => {
  mockNavigate.mockClear()
  logged.length = 0
  wire.fails = false
})

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/sport/log']}>
        <LevelUpProvider>
          <SportLogPage />
        </LevelUpProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** Step one → step two for one sport, by its tile. */
async function pick(name: string | RegExp) {
  await userEvent.click(await screen.findByRole('button', { name }))
}

// ---- step one: the picker ----

test('the picker renders all eleven tiles with their target minutes', async () => {
  const { container } = renderPage()
  expect(await screen.findByText('Mi volt ma mozgás?')).toBeInTheDocument()
  expect(container.querySelectorAll('.es-spg > button')).toHaveLength(11)
  for (const name of [
    'Röplabda', 'CrossFit / HIIT', 'TRX / funkcionális', 'Kerékpár', 'Úszás', 'Foci',
    'Kosárlabda', 'Tenisz', 'Túra', 'Egyéb mozgás', 'Futás',
  ]) {
    expect(screen.getByRole('button', { name: new RegExp(name.replace(/[/]/g, '.')) })).toBeInTheDocument()
  }
  expect(screen.getByRole('button', { name: /Röplabda/ })).toHaveTextContent('~90 perc')
})

test('the Futás tile routes to the running flow instead of opening a sport form', async () => {
  renderPage()
  await pick(/Futás/)
  expect(mockNavigate).toHaveBeenCalledWith('/train/futas')
  // still on the picker — no form opened
  expect(screen.getByText('Mi volt ma mozgás?')).toBeInTheDocument()
})

// ---- step two: the per-sport form ----

test('the form renders the chosen sport\'s own fields, duration prefilled from the target', async () => {
  renderPage()
  await pick(/Kerékpár/)
  expect(await screen.findByLabelText('Időtartam')).toHaveValue(60)
  expect(screen.getByLabelText('Táv')).toHaveValue(25)
  // chips field
  expect(screen.getByRole('button', { name: 'dombos' })).toBeInTheDocument()
  // the mandatory RPE range
  expect(screen.getByLabelText(/Megélt terhelés \(RPE\)/)).toHaveValue('6')
})

test('a modes field gates its onlyMode sibling (volleyball sets appear on Meccs)', async () => {
  renderPage()
  await pick(/Röplabda/)
  expect(await screen.findByRole('button', { name: 'Edzés' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByLabelText('Játszott szettek')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Meccs' }))
  expect(await screen.findByLabelText('Játszott szettek')).toHaveValue(3)
})

test('túra asks for the felt effort too — the wire requires an rpe on every sport', async () => {
  renderPage()
  await pick(/Túra/)
  expect(await screen.findByLabelText(/Megélt terhelés \(RPE\)/)).toBeInTheDocument()
})

test('the free-text field of Egyéb mozgás renders as text', async () => {
  renderPage()
  await pick(/Egyéb mozgás/)
  const input = await screen.findByLabelText('Mi volt?')
  expect(input).toHaveAttribute('type', 'text')
})

test('the back control returns from the form to the picker', async () => {
  renderPage()
  await pick(/Úszás/)
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza a sportválasztóhoz' }))
  expect(await screen.findByText('Mi volt ma mozgás?')).toBeInTheDocument()
})

// ---- honesty: no FE-computed kcal before the save ----

test('the form shows NO kcal number before saving — only the override affordance', async () => {
  const { container } = renderPage()
  await pick(/Röplabda/)
  await screen.findByLabelText('Időtartam')
  expect(container.textContent).toMatch(/Kalória: becslést mentünk/)
  expect(container.textContent).not.toMatch(/\d\s*kcal/)
})

// ---- the override dialog ----

test('the override dialog round-trips the athlete\'s own kcal into the request', async () => {
  renderPage()
  await pick(/Foci/)
  await userEvent.click(await screen.findByRole('button', { name: /Saját érték/ }))
  const field = await screen.findByLabelText('Kalória')
  await userEvent.clear(field)
  await userEvent.type(field, '640')
  await userEvent.click(screen.getByRole('button', { name: /Ezt mentem/ }))
  expect(await screen.findByText(/^Saját értéket adtál meg \(\d+ kcal\) — ezt mentjük, nem a becslést\.$/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Naplózom/ }))
  await waitFor(() => expect(logged).toHaveLength(1))
  expect(logged[0].kcalOverride).toBe(640)
})

test('the override is clearable — the request then carries no kcalOverride', async () => {
  renderPage()
  await pick(/Foci/)
  await userEvent.click(await screen.findByRole('button', { name: /Saját érték/ }))
  const field = await screen.findByLabelText('Kalória')
  await userEvent.clear(field)
  await userEvent.type(field, '640')
  await userEvent.click(screen.getByRole('button', { name: /Ezt mentem/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Töröld a saját értéket' }))
  await waitFor(() =>
    expect(screen.queryByText(/Saját értéket adtál meg/)).not.toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: /Naplózom/ }))
  await waitFor(() => expect(logged).toHaveLength(1))
  expect(logged[0].kcalOverride).toBeUndefined()
})

// The contract's own bounds (@Min(1) @Max(5000) on kcalOverride). Before the T8 final-review
// fix the dialog accepted both, and the request died as a silent 400 — in mock, where nothing
// rejects it, a 0 even reached the ceremony and celebrated "+0 kcal".
test.each(['0', '9999'])('the override dialog refuses %s — it never reaches the request', async (bad) => {
  renderPage()
  await pick(/Foci/)
  await userEvent.click(await screen.findByRole('button', { name: /Saját érték/ }))
  const field = await screen.findByLabelText('Kalória')
  await userEvent.clear(field)
  await userEvent.type(field, bad)
  await userEvent.click(screen.getByRole('button', { name: /Ezt mentem/ }))
  // The dialog stays open with an inline refusal, and no override is taken.
  expect(await screen.findByText('Adj meg egy értéket 1 és 5000 kcal között.')).toBeInTheDocument()
  expect(screen.queryByText(/Saját értéket adtál meg/)).not.toBeInTheDocument()
})

test('the Kalória input carries the contract\'s own min of 1, not 0', async () => {
  renderPage()
  await pick(/Foci/)
  await userEvent.click(await screen.findByRole('button', { name: /Saját érték/ }))
  const field = await screen.findByLabelText('Kalória')
  expect(field).toHaveAttribute('min', '1')
  expect(field).toHaveAttribute('max', '5000')
})

test('a failed save surfaces a Hungarian line and re-enables the CTA', async () => {
  wire.fails = true
  renderPage()
  await pick(/Foci/)
  await userEvent.click(screen.getByRole('button', { name: /Naplózom/ }))
  // Folyadék (prototype `sportlog('hiba')`): the failure is its own card — what happened, what to do, „Újra".
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Nem sikerült elmenteni a mozgást.')
  expect(alert).toHaveTextContent('Nézd meg a kapcsolatot, és próbáld újra.')
  // No ceremony — the form is still there, and the CTA can be pressed again.
  expect(screen.getByRole('button', { name: /Naplózom/ })).toBeEnabled()
  // „Újra" retries the same save; once the wire answers, the ceremony takes over.
  wire.fails = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Újra' }))
  expect(logged).toHaveLength(2)
  expect(await screen.findByText('FOCI · MA')).toBeInTheDocument()
})

// ---- the save: which field lands where on the wire ----

test('volleyball match mode posts setsPlayed and a mapped shoulderStrain', async () => {
  renderPage()
  await pick(/Röplabda/)
  await userEvent.click(await screen.findByRole('button', { name: 'Meccs' }))
  await userEvent.click(screen.getByRole('button', { name: 'erős' }))
  await userEvent.click(screen.getByRole('button', { name: /Naplózom/ }))
  await waitFor(() => expect(logged).toHaveLength(1))
  expect(logged[0]).toMatchObject({ sport: 'volleyball', duration: 90, rpe: 7, setsPlayed: 3, shoulderStrain: 9 })
  expect(logged[0].notes).toContain('Meccs')
})

test('cross posts its rounds on the wire field of the same name', async () => {
  renderPage()
  await pick(/CrossFit/)
  await userEvent.click(await screen.findByRole('button', { name: /Naplózom/ }))
  await waitFor(() => expect(logged).toHaveLength(1))
  expect(logged[0]).toMatchObject({ sport: 'cross', duration: 40, rpe: 8, rounds: 5 })
})

test('fields with no wire home fold into notes as plain Hungarian', async () => {
  renderPage()
  await pick(/Kerékpár/)
  await userEvent.click(await screen.findByRole('button', { name: 'hegyi' }))
  await userEvent.click(screen.getByRole('button', { name: /Naplózom/ }))
  await waitFor(() => expect(logged).toHaveLength(1))
  expect(logged[0].sport).toBe('bike')
  expect(logged[0].notes).toContain('Táv: 25 km')
  expect(logged[0].notes).toContain('Terep: hegyi')
})

test('Egyéb mozgás carries the typed activity name into the notes', async () => {
  renderPage()
  await pick(/Egyéb mozgás/)
  await userEvent.type(await screen.findByLabelText('Mi volt?'), 'fallabda')
  await userEvent.click(screen.getByRole('button', { name: /Naplózom/ }))
  await waitFor(() => expect(logged).toHaveLength(1))
  expect(logged[0].sport).toBe('other')
  expect(logged[0].notes).toContain('fallabda')
})

// ---- Task 5: the ceremony seam ----

test('a successful save lands on the ceremony, not straight back to Mai', async () => {
  renderPage()
  await pick(/Tenisz/)
  await userEvent.click(await screen.findByRole('button', { name: /Naplózom/ }))
  expect(await screen.findByText('TENISZ · MA')).toBeInTheDocument()
  expect(mockNavigate).not.toHaveBeenCalled()
})

test('the ceremony carries the saved minutes/rpe and the response\'s honest kcal', async () => {
  renderPage()
  await pick(/Kerékpár/)
  await userEvent.click(await screen.findByRole('button', { name: /Naplózom/ }))
  await screen.findByText('KERÉKPÁR · MA')
  expect(screen.getByText('500')).toBeInTheDocument() // the mocked response's kcal
  expect(screen.getByText('Becslés, nem mérés')).toBeInTheDocument() // req.kcalOverride == null
})

test('the ceremony\'s close CTA navigates to Mai', async () => {
  renderPage()
  await pick(/Foci/)
  await userEvent.click(await screen.findByRole('button', { name: /Naplózom/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Vissza a mai napra/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/mai')
})

test('an own kcal override reaches the ceremony as "Saját értéked", not an estimate', async () => {
  renderPage()
  await pick(/Foci/)
  await userEvent.click(await screen.findByRole('button', { name: /Saját érték/ }))
  const field = await screen.findByLabelText('Kalória')
  await userEvent.clear(field)
  await userEvent.type(field, '640')
  await userEvent.click(screen.getByRole('button', { name: /Ezt mentem/ }))
  await userEvent.click(screen.getByRole('button', { name: /Naplózom/ }))
  await screen.findByText('FOCI · MA')
  expect(screen.getByText('Saját értéked')).toBeInTheDocument()
})

// ---- copy discipline ----

test('no emoji anywhere on either step — the art is the 3D sprite', async () => {
  const { container } = renderPage()
  const emoji = /\p{Extended_Pictographic}/u
  expect(container.textContent ?? '').not.toMatch(emoji)
  await pick(/Röplabda/)
  await screen.findByLabelText('Időtartam')
  expect(container.textContent ?? '').not.toMatch(emoji)
  // the art is a sprite <svg><use> reference (the sport's own glyph) in the hero, never a text glyph
  expect(within(container).getByLabelText('Időtartam')).toBeInTheDocument()
  expect(container.querySelector('.fo-hero .es-sportart svg use')?.getAttribute('href')).toBe('#t-volley')
})

// ---- Folyadék structure (mezo-n4wf5.3, prototype `sportlog()`) ----

test('the picker is a closed hero + one numbered card; the page draws its own title row (the route has no chrome)', async () => {
  const { container } = renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Naplózás' })).toBeInTheDocument()
  expect(container.querySelector('.es-top small')).toHaveTextContent('Sport · ma')
  expect(container.querySelector('.fo-hero')).toHaveAttribute('data-closed', 'true')
  expect(screen.getByRole('heading', { name: /Válassz sportot/ })).toBeInTheDocument()
  // every tile carries its own glyph in a bubble
  const tiles = container.querySelectorAll('.es-spg > button')
  tiles.forEach((tile) => expect(tile.querySelector('.fo-bub use')).not.toBeNull())
  expect(container.querySelector('.glass, [class*="sp-"], [class*="uvs-"]')).toBeNull()
})

test('the form is hero (glyph + mode switch) → 1 Idő és terhelés → 2 Kalória → the floating save', async () => {
  const { container } = renderPage()
  await pick(/Röplabda/)
  expect(await screen.findByRole('heading', { level: 1, name: 'Röplabda' })).toBeInTheDocument()
  expect(container.querySelector('.es-top small')).toHaveTextContent('Naplózás · ma')
  expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('Hogy ment?')
  // the mode switch lives in the hero, named by the field
  expect(within(container.querySelector('.fo-hero') as HTMLElement).getByRole('group', { name: 'Típus' })).toBeInTheDocument()
  expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(['1Idő és terhelés', '2Kalória'])
  // a number is the kit's stepper row, labelled „<mező> · <egység>"
  expect(screen.getByText('Időtartam · perc').closest('.fo-row')?.querySelector('.fo-stp')).not.toBeNull()
  // the save floats in the page's foot and names the minutes it will log
  expect(container.querySelector('.fo-foot.nonav')).toHaveTextContent('Naplózom · 90 perc')
  await userEvent.click(screen.getByRole('button', { name: 'Időtartam növelése' }))
  expect(container.querySelector('.fo-foot')).toHaveTextContent('Naplózom · 95 perc')
  expect(container.querySelector('.glass, [class*="sp-"]:not([data-sp-key]), [class*="uvs-"], .wo-close-cta')).toBeNull()
})

test('the kcal override opens as a light sheet and closes on save', async () => {
  renderPage()
  await pick(/Foci/)
  await userEvent.click(await screen.findByRole('button', { name: /Saját érték/ }))
  const sheet = await screen.findByRole('dialog', { name: 'Aktív kalória (ha az órád mérte)' })
  expect(sheet).toHaveClass('fo-sheet')
  await userEvent.type(within(sheet).getByLabelText('Kalória'), '520')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Ezt mentem' }))
  expect(await screen.findByText('Saját értéket adtál meg (520 kcal) — ezt mentjük, nem a becslést.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
