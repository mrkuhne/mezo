import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ExercisesPage } from '@/features/train/pages/ExercisesPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Real-mode view: records + catalog come from the MSW fixtures.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () =>
  render(<QueryWrapper><MemoryRouter><ExercisesPage /></MemoryRouter></QueryWrapper>)

test('own header: pghead-np over + h1', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  expect(screen.getByText('Edzés · Gyakorlatok')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Gyakorlatok' })).toBeInTheDocument()
})

// Mozaik re-face (mezo-d20.3.3): compact hero (icon + catalog count) + an honest
// 3-cell stat strip (rekord/saját/videóval) below the header — the prototype's
// 4th cell ("PR e héten") is dropped: no dated week-boundary contract exists to
// derive it truthfully (honest states over placeholder theatre).
test('compact hero shows the catalog count + an honest record/saját/videóval stat strip', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  expect(screen.getByText('6')).toBeInTheDocument() // catalog size (fixture: 6 rows)
  const strip = screen.getByLabelText('Katalógus áttekintés')
  expect(within(strip).getByText('4')).toBeInTheDocument() // rekord (4 records in fixture)
  expect(within(strip).getByText('rekord')).toBeInTheDocument()
  expect(within(strip).getByText('1')).toBeInTheDocument() // saját (Chest Supported Row only)
  expect(within(strip).getByText('saját')).toBeInTheDocument()
  expect(within(strip).getByText('2')).toBeInTheDocument() // videóval (Chest Supported Row + Hip Thrust)
  expect(within(strip).getByText('videóval')).toBeInTheDocument()
})

test('default state ranks top exercises with best set and e1RM chip', async () => {
  renderView()
  expect(await screen.findByText('Top gyakorlatok · rekordjaid')).toBeInTheDocument()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  expect(within(row).getByText('#1')).toBeInTheDocument()          // inline #n rank prefix
  expect(within(row).getByText('102.5×9')).toBeInTheDocument()    // Legjobb szett cell
  expect(within(row).getByText('133.3 kg')).toBeInTheDocument()   // e1RM cell
  expect(within(row).getByText('182.5 t')).toBeInTheDocument()    // Összvolumen cell
  expect(within(row).getByText('Hát (közép)')).toBeInTheDocument()// muscle pill
  expect(within(row).getByText('21 alkalom')).toBeInTheDocument() // sessions pill
  expect(within(row).getByText('Saját')).toBeInTheDocument()      // editable badge
  // bodyweight (plyo) record: rep-based stat cells + filled plyo pill
  const plyoRow = screen.getByRole('button', { name: /Box Jump/ })
  expect(within(plyoRow).getByText('Max rep')).toBeInTheDocument()
  expect(within(plyoRow).getByText('12')).toBeInTheDocument()     // max reps from recentTopSets
  expect(within(plyoRow).getByText('186')).toBeInTheDocument()    // Összes rep
  expect(within(plyoRow).getByText(/Plyo/)).toBeInTheDocument()   // ⚡ Plyo pill
})

test('a name-grouped record (no catalogId) gets the video affordance via name fallback', async () => {
  renderView()
  const row = await screen.findByRole('button', { name: /Hip Thrust/ })
  // the record fixture has no catalogId — the catalog row (with its video) is
  // resolved by name, so the roundel is the EDIT affordance seeded with the URL
  const scope = within(row.parentElement as HTMLElement)
  await userEvent.click(scope.getByRole('button', { name: 'Videó szerkesztése' }))
  expect(await screen.findByText('Videó · Hip Thrust')).toBeInTheDocument()
  expect(screen.getByLabelText('Videó URL')).toHaveValue('https://youtu.be/xDmFkJxPzeM')
})

test('a name-grouped record opens the record sheet WITH the demo player chip', async () => {
  renderView()
  // the videoUrl prop must resolve through the same name fallback (mezo-7ndk)
  await userEvent.click(await screen.findByRole('button', { name: /Hip Thrust/ }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByRole('button', { name: /Demo/ })).toBeInTheDocument()
})

test('the record sheet heroes the catalog demo stills above the video chip', async () => {
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: /Hip Thrust/ }))
  const sheet = await screen.findByRole('dialog')
  // Resolved through the same name fallback as videoUrl; the pair renders as one figure.
  const frames = sheet.querySelectorAll('.exdemo img')
  expect(frames).toHaveLength(2)
  expect(frames[0]).toHaveAttribute('src', '/exercises/hip-thrust-a.jpg')
})

test('a record whose catalog row has no image renders no demo figure at all', async () => {
  renderView()
  // Box Jump is imageless in the fixture, like the 37 unmapped master rows.
  await userEvent.click(await screen.findByRole('button', { name: /Box Jump/ }))
  const sheet = await screen.findByRole('dialog')
  expect(sheet.querySelector('.exdemo')).toBeNull()
})

test('a bodyweight record with weightKg 0 (live-backend shape) uses the rep stat branch', async () => {
  renderView()
  const row = await screen.findByRole('button', { name: /Dead Hang/ })
  // no weighted cells — 0×35 / e1RM 0 must NOT appear
  expect(within(row).queryByText('0×35')).not.toBeInTheDocument()
  expect(within(row).queryByText('e1RM')).not.toBeInTheDocument()
  expect(within(row).getByText('Max rep')).toBeInTheDocument()
  expect(within(row).getByText('35')).toBeInTheDocument()
  expect(within(row).getByText('65')).toBeInTheDocument()
})

test('search merges record rows with catalog ghost rows', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'r')
  expect(screen.getByText('Találatok · teljes katalógus')).toBeInTheDocument()
  // record match still a button; catalog-only match renders as a ghost row
  expect(screen.getByRole('button', { name: /Chest Supported Row/ })).toBeInTheDocument()
  expect(screen.getByText('Lateral Raise')).toBeInTheDocument()
  expect(screen.getAllByText(/MÉG NINCS REKORD/i).length).toBeGreaterThan(0)
})

test('the search field carries an accessible name, not just a placeholder', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  expect(screen.getByRole('textbox', { name: 'Keresés a gyakorlatok között' })).toBeInTheDocument()
})

test('a ghost row is not a button — nothing to open until it has a record', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'lateral')
  // Lateral Raise is catalog-only in the fixture: it renders, but as inert copy —
  // a dead button would promise a record sheet that cannot open (mezo-setx.6.7).
  expect(screen.getByText('Lateral Raise')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Lateral Raise/ })).not.toBeInTheDocument()
})

test('plyo chip filters records and ghosts by type', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.click(screen.getByRole('button', { name: 'Plyo' }))
  expect(await screen.findByRole('button', { name: /Box Jump/ })).toBeInTheDocument()
  expect(screen.queryByText('Chest Supported Row')).not.toBeInTheDocument()
})

test('tapping a record row opens the record sheet', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.click(await screen.findByRole('button', { name: /Chest Supported Row/ }))
  expect(await screen.findByRole('heading', { name: 'Chest Supported Row' })).toBeInTheDocument()
  expect(screen.getByText('102.5 kg × 9')).toBeInTheDocument()
})

test('empty records show the ghost state while the catalog search stays usable', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercise-records`, () => HttpResponse.json([])),
  )
  renderView()
  expect(await screen.findByText(/Az első logolt edzés után itt nőnek a rekordjaid/)).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'calf')
  expect(screen.getByText('Standing Calf Raise')).toBeInTheDocument()
})

// Loading skeleton (mezo-f2z) — real mode shows the ExercisesSkeleton (role="status")
// while the catalog/records queries are unresolved (exercisesPending); mock seeds → none.
// Writable catalog (mezo-52zg) — the header authoring button + edit/delete
// affordances on user-authored (editable) rows. The MSW catalog fixture marks
// Chest Supported Row editable with a videoUrl, and it also has a record, so it
// renders as a record row in the default (unsearched) view.
test('the header + Új gyakorlat button opens the create sheet', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.click(screen.getByRole('button', { name: /Új gyakorlat/ }))
  expect(await screen.findByText('Gyakorlat · Katalógus')).toBeInTheDocument()
  expect(screen.getByLabelText('Név')).toHaveValue('')
})

test('an editable record row exposes the ⋯ edit roundel but no page-level delete', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  expect(screen.getByRole('button', { name: 'Gyakorlat szerkesztése' })).toBeInTheDocument()
  // delete moved into CatalogExerciseSheet (mezo-kaui) — no longer on the page
  expect(screen.queryByRole('button', { name: 'Gyakorlat törlése' })).not.toBeInTheDocument()
})

test('editing an owned row opens the sheet seeded with its name', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlat szerkesztése' }))
  expect(await screen.findByText('Gyakorlat szerkesztése')).toBeInTheDocument()
  expect(screen.getByLabelText('Név')).toHaveValue('Chest Supported Row')
})

test('deleting an owned row goes through the edit sheet with a confirm step', async () => {
  let deleted = ''
  server.use(
    http.delete(`${API_BASE}/api/train/exercises/:id`, ({ params }) => {
      deleted = String(params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlat szerkesztése' }))
  const del = await screen.findByRole('button', { name: 'Gyakorlat törlése' })
  await userEvent.click(del)                      // first tap: arm
  expect(deleted).toBe('')                        // not deleted yet
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlat törlése' })) // confirm
  await waitFor(() => expect(deleted).toBe('f1e3a0e2-0000-4000-8000-000000000070'))
})

// Video affordance (mezo-bnsk) — the demo video can be attached to ANY catalog row.
// Box Jump is a seed (non-editable) record row: it has NO edit/delete affordance but
// DOES get a video button. Chest Supported Row is editable and already has a video.
test('a seed (non-editable) record row exposes a video-add affordance and opens the sheet', async () => {
  renderView()
  const boxRow = await screen.findByRole('button', { name: /Box Jump/ })
  // Box Jump carries no edit/delete (not editable), but the video-add roundel is
  // present (scoped: Hip Thrust's no-video row exposes the same label) and opens
  // the VideoUrlSheet for it.
  const scope = within(boxRow.parentElement as HTMLElement)
  await userEvent.click(scope.getByRole('button', { name: 'Videó hozzáadása' }))
  expect(await screen.findByText('Videó · Box Jump')).toBeInTheDocument()
  expect(screen.getByLabelText('Videó URL')).toHaveValue('')
})

test('an editable row with a video exposes a video-edit affordance seeded with its URL', async () => {
  renderView()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.click(within(row.parentElement as HTMLElement).getByRole('button', { name: 'Videó szerkesztése' }))
  expect(await screen.findByText('Videó · Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByLabelText('Videó URL')).toHaveValue('https://youtu.be/GZTvxN5fPBc')
})

test('setting a video on a seed row issues the PUT /video request', async () => {
  let videoId = ''
  let videoBody: unknown = null
  server.use(
    http.put(`${API_BASE}/api/train/exercises/:id/video`, async ({ params, request }) => {
      videoId = String(params.id)
      videoBody = await request.json()
      return HttpResponse.json({ id: params.id, slug: 'box-jump', ...(videoBody as object) })
    }),
  )
  renderView()
  const boxRow = await screen.findByRole('button', { name: /Box Jump/ })
  await userEvent.click(within(boxRow.parentElement as HTMLElement).getByRole('button', { name: 'Videó hozzáadása' }))
  await userEvent.type(await screen.findByLabelText('Videó URL'), 'https://youtu.be/dQw4w9WgXcQ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(videoId).toBe('f1e3a0e2-0000-4000-8000-000000000072'))
  expect(videoBody).toEqual({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
})

// Multi-user catalog (mezo-qw37.5): a row another user authored is SHARED — it renders with a
// `Közös · {név}` stamp and, because the viewer may neither edit nor re-mediate it, with NO
// roundel at all. The MSW fixture's Lateral Raise is Anna's (catalog-only, so a ghost row).
test('a shared row from another user carries the Közös badge and no edit/video roundel', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'lateral')
  const name = screen.getByText('Lateral Raise')
  const card = name.closest('.excat') as HTMLElement
  expect(within(card).getByText('Közös · Anna')).toBeInTheDocument()
  expect(within(card).queryByText('Saját')).not.toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: 'Gyakorlat szerkesztése' })).not.toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: /^Videó/ })).not.toBeInTheDocument()
})

test('a master row shows neither Saját nor Közös, and the video roundel follows mediaEditable', async () => {
  renderView()
  const boxRow = await screen.findByRole('button', { name: /Box Jump/ })
  const card = boxRow.closest('.excat') as HTMLElement
  expect(within(card).queryByText('Saját')).not.toBeInTheDocument()
  expect(within(card).queryByText(/Közös/)).not.toBeInTheDocument()
  // the fixture viewer is the OWNER → master media stays editable for them
  expect(within(card).getByRole('button', { name: 'Videó hozzáadása' })).toBeInTheDocument()
})

test('a master row hides the video roundel when the viewer may not re-mediate it', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercises`, () =>
      HttpResponse.json([
        { id: 'f1e3a0e2-0000-4000-8000-000000000072', slug: 'box-jump', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0.6, fatigue: 0.35, editable: false, mediaEditable: false, authoredByMe: false, authorName: null },
      ]),
    ),
  )
  renderView()
  const boxRow = await screen.findByRole('button', { name: /Box Jump/ })
  const card = boxRow.closest('.excat') as HTMLElement
  expect(within(card).queryByRole('button', { name: /^Videó/ })).not.toBeInTheDocument()
})

test('the saját stat counts authored rows, not editable ones', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercises`, () =>
      HttpResponse.json([
        // the OWNER may edit Anna's row (editable) but did not author it — must not count as saját
        { id: 'f1e3a0e2-0000-4000-8000-000000000073', slug: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulder-side', type: 'isolation', stim: 0.72, fatigue: 0.2, editable: true, mediaEditable: true, authoredByMe: false, authorName: 'Anna' },
        { id: 'f1e3a0e2-0000-4000-8000-000000000070', slug: 'chest-supported-row', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55, editable: true, mediaEditable: true, authoredByMe: true, authorName: 'Daniel' },
      ]),
    ),
  )
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  const strip = screen.getByLabelText('Katalógus áttekintés')
  expect(within(strip).getByText('saját').previousElementSibling).toHaveTextContent('1')
})

describe('ExercisesPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the catalog + records queries are unresolved', async () => {
    // exercisesPending = catalogPending || recordsPending — never-resolve both.
    server.use(
      http.get(`${API_BASE}/api/train/exercises`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/exercise-records`, () => new Promise(() => {})),
    )
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('ExercisesPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })
  // The static Phase-1 catalog carries no backend catalogId, so it exposes no video
  // affordance — the video button is gated on a real backend catalog row (mezo-bnsk).
  it('exposes no video affordance on static catalog ghost rows', async () => {
    renderView()
    await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'bench')
    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Videó/ })).toBeNull()
  })
  // The Phase-1 static seed carries no authorship → no Közös stamp anywhere in mock mode.
  it('shows no Közös badge on static catalog rows', async () => {
    renderView()
    await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'row')
    expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
    expect(screen.queryByText(/Közös/)).toBeNull()
  })
})

test('a record card leads with the catalog thumbnail and keeps the rank as a #n prefix', async () => {
  renderView()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  // Chest Supported Row is one of the 37 unmapped slugs — the slot is still
  // reserved, by the fallback TILE (a div), so the list's left edge stays straight.
  const tile = row.querySelector('.exdemo-thumb')
  expect(tile).not.toBeNull()
  expect(tile!.tagName).toBe('DIV')
  expect(within(row).getByText('#1')).toBeInTheDocument()
  // Hip Thrust carries stills in the MSW catalog fixture (mezo-8xdl.3) → a real <img>.
  const hip = await screen.findByRole('button', { name: /Hip Thrust/ })
  expect(hip.querySelector('img.exdemo-thumb')).not.toBeNull()
})

// Motion (mezo-d20.11): only the RESULT LIST was inside an EntranceGroup — the
// hero strip, the search field, the filter chips and the list head had no
// `.rise` at all, so the page chrome snapped in. The chrome now has its own
// one-shot group (prototype #page-gyak: 30 · 60 · 90 · 120ms) while the list
// keeps its filter-keyed group beneath it.
test('the page chrome staggers inside its own entrance group', async () => {
  const { container } = renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  const at = (d: string) =>
    [...play!.querySelectorAll('.rise')].filter((el) => (el as HTMLElement).style.getPropertyValue('--d') === d)
  expect(play!.querySelector('.mz-statstrip.rise')).not.toBeNull()
  expect(at('30ms').length).toBe(1)
  expect(play!.querySelector('.searchfield.rise')).not.toBeNull()
  expect(at('60ms').length).toBe(1)
  expect(at('90ms').length).toBe(1)
  expect(at('120ms').length).toBe(1)
})
