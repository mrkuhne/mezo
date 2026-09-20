import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrainSettingsPage } from '@/features/settings/pages/TrainSettingsPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

test('the central sport editor preserves existing slots and saves the full replacement', async () => {
  const requests: unknown[] = []
  server.use(http.put(`${API_BASE}/api/train/sport-schedule`, async ({ request }) => {
    requests.push(await request.json())
    return HttpResponse.json([])
  }))
  render(<QueryWrapper><MemoryRouter><TrainSettingsPage editor="sport" /></MemoryRouter></QueryWrapper>)
  expect(await screen.findByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Csütörtök sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(requests).toHaveLength(1))
  expect((requests[0] as Array<{ dayOfWeek: number }>).map(slot => slot.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5])
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
