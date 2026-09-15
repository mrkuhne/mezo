// ============================================================
// Mezo · FuelLogModes tests (Fuel Titanium S1c, mezo-33k6; manifeszt A4 · A5 · A6 · A7).
//
// A héj szerződései: a kamera a DEFAULT, a módok sorrendje rögzített (fotó → hang → gépelés →
// szokásosak), a fotó a HÍVÓHOZ jut (nem ment és nem hív AI-t magától), a felismerés kudarca
// teljes értékű állapot a másik három úttal, és előzmény nélkül a szokásosak fül ŐSZINTÉN üres.
//
// A `useVoiceInput` stubolt: jsdom alatt nincs getUserMedia/MediaRecorder.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const voice = vi.hoisted(() => ({
  onTranscript: null as null | ((t: string) => void),
  state: 'idle' as 'unsupported' | 'idle' | 'recording' | 'transcribing',
  error: null as string | null,
  toggle: vi.fn(),
}))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voice.onTranscript = onTranscript
    return { state: voice.state, error: voice.error, toggle: voice.toggle }
  },
}))

import { FuelLogModes, type LogMode } from '@/features/fuel/components/FuelLogModes'
import type { UsualMeal } from '@/features/fuel/logic/usualMeals'

const usual = (over: Partial<UsualMeal> = {}): UsualMeal => ({
  key: 'breakfast:zabkása', title: 'Zabkása gyümölccsel', slot: 'breakfast',
  kcal: 420, lastLoggedIso: '2026-09-10T08:05:00+02:00', count: 4,
  ...over,
})

function props(over: Partial<Parameters<typeof FuelLogModes>[0]> = {}) {
  return {
    mode: 'photo' as LogMode,
    onMode: vi.fn(),
    onPhoto: vi.fn(),
    onUsual: vi.fn(),
    onTranscript: vi.fn(),
    failed: false,
    usuals: [usual()],
    ...over,
  }
}

// A4 (mezo-33k6): a kamera a DEFAULT — ez az owner első számú módja.
test('a felület a kamerán nyit', () => {
  const { container } = render(<FuelLogModes {...props()} />)
  expect(container.querySelector('.fmx-mode.is-active')!.textContent).toMatch(/Fotó/)
})

// A módok sorrendje rögzített: fotó → hang → gépelés → szokásosak.
test('a módok a jóváhagyott sorrendben állnak', () => {
  const { container } = render(<FuelLogModes {...props()} />)
  expect(Array.from(container.querySelectorAll('.fmx-mode')).map(b => b.textContent!.trim()))
    .toEqual(['Fotó', 'Hang', 'Gépelés', 'Szokásosak'])
})

test('a fül koppintása a hívóhoz jut, nem vált magától', async () => {
  const onMode = vi.fn()
  render(<FuelLogModes {...props({ onMode })} />)
  await userEvent.click(screen.getByRole('tab', { name: /Szokásosak/ }))
  expect(onMode).toHaveBeenCalledWith('usual')
})

test('a fotó kiválasztása a hívóhoz jut, nem közvetlenül ment', async () => {
  const onPhoto = vi.fn()
  render(<FuelLogModes {...props({ onPhoto })} />)
  await userEvent.upload(screen.getByLabelText(/Étel fotó/i), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
  expect(onPhoto).toHaveBeenCalledTimes(1)
})

// A4: a felismerés kudarca teljes értékű állapot, ami a másik három utat kínálja.
test('a felismerés kudarca a másik három utat kínálja, nem hibaüzenetet', async () => {
  render(<FuelLogModes {...props({ failed: true })} />)
  expect(screen.getByText(/nem ismertem fel/i)).toBeInTheDocument()
  for (const name of [/Leírom szöveggel/, /szokásosakból/, /Új fotót/]) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  }
})

test('a kudarc-állapot gombjai a három útra váltanak', async () => {
  const onMode = vi.fn()
  render(<FuelLogModes {...props({ failed: true, onMode })} />)
  await userEvent.click(screen.getByRole('button', { name: /Leírom szöveggel/ }))
  await userEvent.click(screen.getByRole('button', { name: /szokásosakból/ }))
  expect(onMode.mock.calls.map(c => c[0])).toEqual(['text', 'usual'])
})

// A7: előzmény nélkül nem találunk ki szokásokat.
test('előzmény nélkül a szokásosak fül őszintén üres', () => {
  render(<FuelLogModes {...props({ mode: 'usual', usuals: [] })} />)
  expect(screen.getByText(/Még tanulom, mit szoktál enni/i)).toBeInTheDocument()
})

test('a szokásos sor koppintása a hívóhoz adja a sort', async () => {
  const onUsual = vi.fn()
  const row = usual()
  render(<FuelLogModes {...props({ mode: 'usual', usuals: [row], onUsual })} />)
  await userEvent.click(screen.getByRole('button', { name: /Zabkása gyümölccsel/ }))
  expect(onUsual).toHaveBeenCalledWith(row)
})

// Őszinte-null: kcal nélküli szokásos sor NEM kap kitalált számot.
test('ismeretlen kalóriájú szokásos sor „—"-t mutat, nem becsült számot', () => {
  render(<FuelLogModes {...props({ mode: 'usual', usuals: [usual({ kcal: null })] })} />)
  expect(screen.getByText('—')).toBeInTheDocument()
})

// A6: a hang-fül a VALÓDI felismerőt hozza — a leiratozott mondat a hívóhoz jut.
test('a bemondott mondat a hívóhoz jut', () => {
  const onTranscript = vi.fn()
  render(<FuelLogModes {...props({ mode: 'voice', onTranscript })} />)
  voice.onTranscript!('Egy joghurt és egy banán volt.')
  expect(onTranscript).toHaveBeenCalledWith('Egy joghurt és egy banán volt.')
})

test('hangfelismerés nélkül a nagy mikrofon tiltott, nem hazudik működőt', () => {
  voice.state = 'unsupported'
  try {
    render(<FuelLogModes {...props({ mode: 'voice' })} />)
    expect(screen.getByRole('button', { name: /hang/i })).toBeDisabled()
  } finally {
    voice.state = 'idle'
  }
})

// A prototípus demó-kellékei NEM jöhetnek át a produkcióba.
test('a héj semmilyen demó-kelléket nem visel', () => {
  const { container } = render(<FuelLogModes {...props()} />)
  expect(container.textContent).not.toMatch(/demó|minta|nincs valódi/i)
  expect(screen.queryByRole('button', { name: /Exponálás/i })).not.toBeInTheDocument()
})
