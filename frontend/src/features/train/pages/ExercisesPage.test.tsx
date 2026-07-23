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

test('default state ranks top exercises with best set and e1RM chip', async () => {
  renderView()
  expect(await screen.findByText('Top gyakorlatok · rekordjaid')).toBeInTheDocument()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  expect(within(row).getByText('01')).toBeInTheDocument()
  expect(within(row).getByText('102.5×9')).toBeInTheDocument()
  expect(within(row).getByText('e1RM 133.3')).toBeInTheDocument()
  // bodyweight record rows surface the rep counter instead
  const plyoRow = screen.getByRole('button', { name: /Box Jump/ })
  expect(within(plyoRow).getByText('186 rep')).toBeInTheDocument()
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

test('an editable record row exposes edit + delete affordances', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  expect(screen.getByRole('button', { name: 'Gyakorlat szerkesztése' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gyakorlat törlése' })).toBeInTheDocument()
})

test('editing an owned row opens the sheet seeded with its name', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlat szerkesztése' }))
  expect(await screen.findByText('Gyakorlat szerkesztése')).toBeInTheDocument()
  expect(screen.getByLabelText('Név')).toHaveValue('Chest Supported Row')
})

test('deleting an owned row issues the delete request', async () => {
  let deleted = ''
  server.use(
    http.delete(`${API_BASE}/api/train/exercises/:id`, ({ params }) => {
      deleted = String(params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlat törlése' }))
  await waitFor(() => expect(deleted).toBe('f1e3a0e2-0000-4000-8000-000000000070'))
})

// Video affordance (mezo-bnsk) — the demo video can be attached to ANY catalog row.
// Box Jump is a seed (non-editable) record row: it has NO edit/delete affordance but
// DOES get a video button. Chest Supported Row is editable and already has a video.
test('a seed (non-editable) record row exposes a video-add affordance and opens the sheet', async () => {
  renderView()
  await screen.findByRole('button', { name: /Box Jump/ })
  // Box Jump carries no edit/delete (not editable)...
  const boxRow = screen.getByRole('button', { name: /Box Jump/ })
  expect(boxRow).toBeInTheDocument()
  // ...but the video-add button is present and opens the VideoUrlSheet for it.
  await userEvent.click(screen.getByRole('button', { name: 'Videó hozzáadása' }))
  expect(await screen.findByText('Videó · Box Jump')).toBeInTheDocument()
  expect(screen.getByLabelText('Videó URL')).toHaveValue('')
})

test('an editable row with a video exposes a video-edit affordance seeded with its URL', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.click(screen.getByRole('button', { name: 'Videó szerkesztése' }))
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
  await screen.findByRole('button', { name: /Box Jump/ })
  await userEvent.click(screen.getByRole('button', { name: 'Videó hozzáadása' }))
  await userEvent.type(await screen.findByLabelText('Videó URL'), 'https://youtu.be/dQw4w9WgXcQ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(videoId).toBe('f1e3a0e2-0000-4000-8000-000000000072'))
  expect(videoBody).toEqual({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
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
})
