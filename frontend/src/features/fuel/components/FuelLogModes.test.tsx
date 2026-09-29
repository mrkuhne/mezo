import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { FuelLogModes, type LogMode } from '@/features/fuel/components/FuelLogModes'
import type { UsualMeal } from '@/features/fuel/logic/usualMeals'

const usual: UsualMeal = {
  key: 'breakfast:zabkasa', title: 'Zabkása gyümölccsel', slot: 'breakfast',
  kcal: 420, lastLoggedIso: '2026-09-10T08:05:00+02:00', count: 4,
}

function props(over: Partial<Parameters<typeof FuelLogModes>[0]> = {}) {
  return {
    mode: 'photo' as LogMode,
    onMode: vi.fn(),
    onSource: vi.fn(),
    photo: null as File | null,
    onPhoto: vi.fn(),
    onRemovePhoto: vi.fn(),
    onUsual: vi.fn(),
    failed: false,
    usuals: [usual],
    ...over,
  }
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:meal-photo') as never
  URL.revokeObjectURL = vi.fn() as never
})
afterEach(() => vi.restoreAllMocks())

test('a négy közvetlen út Fotó, Kamra, Recept, Szokásosak; nincs külön hang vagy gépelés', () => {
  const { container } = render(<FuelLogModes {...props()} />)
  expect(Array.from(container.querySelectorAll('.fmx-mode')).map(b => b.textContent!.trim()))
    .toEqual(['Fotó', 'Kamra', 'Recept', 'Szokásosak'])
  expect(screen.getByText('Fotózd le a tányért')).toBeInTheDocument()
})

test('Kamra és Recept közvetlenül a meglévő pickerhez vezet', async () => {
  const onSource = vi.fn()
  render(<FuelLogModes {...props({ onSource })} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kamra' }))
  await userEvent.click(screen.getByRole('button', { name: 'Recept' }))
  expect(onSource.mock.calls.map(call => call[0])).toEqual(['pantry', 'recipe'])
})

test('fotó kiválasztása után a nagy előnézet látható, cserélhető és eltávolítható', async () => {
  const file = new File(['x'], 'tanyer.jpg', { type: 'image/jpeg' })
  const onPhoto = vi.fn()
  const onRemovePhoto = vi.fn()
  const { rerender } = render(<FuelLogModes {...props({ onPhoto, onRemovePhoto })} />)
  await userEvent.upload(screen.getByLabelText('Étel fotó · kamera'), file)
  expect(onPhoto).toHaveBeenCalledWith(file)
  rerender(<FuelLogModes {...props({ photo: file, onPhoto, onRemovePhoto })} />)
  expect(await screen.findByAltText('A kiválasztott étel fotója')).toHaveAttribute('src', 'blob:meal-photo')
  expect(screen.getByText('tanyer.jpg')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fotó eltávolítása' }))
  expect(onRemovePhoto).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Csere' })).toBeInTheDocument()
})

test('szokásosak előzmény nélkül őszintén üres, kiválasztva a hívóhoz jut', async () => {
  const onMode = vi.fn()
  const onUsual = vi.fn()
  const { rerender } = render(<FuelLogModes {...props({ mode: 'usual', usuals: [], onMode, onUsual })} />)
  expect(screen.getByText(/Még tanulom, mit szoktál enni/)).toBeInTheDocument()
  rerender(<FuelLogModes {...props({ mode: 'usual', onMode, onUsual })} />)
  await userEvent.click(screen.getByRole('button', { name: /Zabkása gyümölccsel/ }))
  expect(onUsual).toHaveBeenCalledWith(usual)
})

test('sikertelen fotóelemzés után a szöveg és az új fotó útja látható', () => {
  render(<FuelLogModes {...props({ failed: true })} />)
  expect(screen.getByText(/nem ismertem fel/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Új fotót/ })).toBeInTheDocument()
  expect(screen.getByText(/Írd le lent/)).toBeInTheDocument()
})
