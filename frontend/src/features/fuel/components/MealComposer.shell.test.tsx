// ============================================================
// Mezo · MealComposer — EGY naplózó, nem kettő (Fuel Titanium S1c.2, mezo-33k6).
//
// A héj (`FuelLogModes`) birtokolja a „hogyan kezdem" kérdést, a composer pedig azt, hogy
// „megerősítem, amit elkaptam". Ez a fájl a látványossági szerződést őrzi:
//   • héj alatt NINCS második ✨ AI bejárat (az a valódi duplikáció),
//   • héj NÉLKÜL (a LogFlow-overlay: recept, kamra, Életjel, Rutin) minden marad, ahogy volt,
//   • a kézi források (Kamra · Recept) nem tűnnek el — a GÉPELÉS úthoz tartoznak (manifeszt A3),
//   • a megerősítő rész (MIKOR · TÉTELEK · mentés-CTA) csak akkor jön, ha VAN mit megerősíteni,
//   • a `fixedSlot` szabálya változatlan: ott a MIKOR sosem jelenik meg.
//
// A harness a szomszédos MealComposer.*.test.tsx mintája: mock mód, valódi hookok, EGY
// QueryClient. A „seedelt sor" a meglévő `prefill` úton jön (a composernek nincs sor-propja) —
// a recept-azonosítót az app saját `useRecipes`-e adja, nem egy találgatott string.
// ============================================================
import type { ReactNode } from 'react'
import { render, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useRecipes } from '@/data/hooks'
import { MealComposer, type MealComposerProps } from '@/features/fuel/components/MealComposer'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

type Opts = Partial<MealComposerProps> & { seedLine?: boolean }

function renderComposer({ seedLine, ...props }: Opts = {}) {
  const wrapper = makeWrapper()
  const prefill: MealComposerProps['prefill'] = seedLine
    ? { source: 'recipe', recipeId: renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0].id }
    : null
  return render(
    <MealComposer prefill={prefill} onSaved={() => {}} onCancel={() => {}} {...props} />,
    { wrapper },
  )
}

// ── A duplikált bejárat ──────────────────────────────────────────────────────────────────────

test('héj alatt nincs második AI kártya', () => {
  renderComposer({ shellOwnsEntry: true })
  expect(screen.queryByRole('button', { name: /AI · fotó vagy szöveg/ })).not.toBeInTheDocument()
})

test('héj nélkül a szerkesztő megtartja a saját AI kártyáját', () => {
  renderComposer()
  expect(screen.getByRole('button', { name: /AI · fotó vagy szöveg/ })).toBeInTheDocument()
})

test('héj alatt is megvan az EGYETLEN AI-szövegmező — a héj azt nyitja ki', () => {
  renderComposer({ shellOwnsEntry: true, aiPanelOpenOnMount: true })
  expect(screen.getByLabelText('Mit ettél?')).toBeInTheDocument()
})

// ── A3: a kézi források nem tűnnek el, csak a gépelés úthoz kerülnek ─────────────────────────

test('a gépelés úton a Kamra és a Recept elérhető', () => {
  renderComposer({ shellOwnsEntry: true, manualSources: true })
  expect(screen.getByRole('button', { name: 'Kamra · hozzáadás' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recept · hozzáadás' })).toBeInTheDocument()
})

test('a fotó úton a kézi források nem tolakodnak elő', () => {
  renderComposer({ shellOwnsEntry: true, manualSources: false })
  expect(screen.queryByRole('button', { name: 'Kamra · hozzáadás' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Recept · hozzáadás' })).not.toBeInTheDocument()
})

test('héj nélkül a kézi források akkor is ott vannak, ha a hívó nem mond semmit', () => {
  renderComposer()
  expect(screen.getByRole('button', { name: 'Kamra · hozzáadás' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recept · hozzáadás' })).toBeInTheDocument()
})

// ── A megerősítő rész csak akkor jelenik meg, ha VAN mit megerősíteni ────────────────────────

test('tétel nélkül nincs üres tétel-lista és nincs mentés gomb', () => {
  renderComposer({ shellOwnsEntry: true })
  expect(screen.queryByText('TÉTELEK')).not.toBeInTheDocument()
  expect(screen.queryByText('MIKOR')).not.toBeInTheDocument()
  expect(screen.queryByText(/Még nincs tétel/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Logolás · \+10 XP/ })).not.toBeInTheDocument()
})

test('az első tétel megjelenésével jön a megerősítő rész', () => {
  renderComposer({ shellOwnsEntry: true, seedLine: true })
  expect(screen.getByText('TÉTELEK')).toBeInTheDocument()
  expect(screen.getByText('MIKOR')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logolás · \+10 XP/ })).toBeInTheDocument()
})

test('héj nélkül tétel nélkül is a megszokott teljes szerkesztő jön (overlay-bejáratok)', () => {
  renderComposer()
  expect(screen.getByText('TÉTELEK')).toBeInTheDocument()
  expect(screen.getByText('MIKOR')).toBeInTheDocument()
  expect(screen.getByText(/Még nincs tétel/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logolás · \+10 XP/ })).toBeDisabled()
})

test('a kiszállás ajtaja héj alatt, tétel nélkül is nyitva van', () => {
  renderComposer({ shellOwnsEntry: true })
  expect(screen.getByRole('button', { name: 'Mégse' })).toBeInTheDocument()
})

// ── A rögzített ablak szabálya változatlan ───────────────────────────────────────────────────

test('rögzített ablaknál a MIKOR továbbra sem jelenik meg', () => {
  renderComposer({ shellOwnsEntry: true, fixedSlot: 'snack', seedLine: true })
  expect(screen.queryByText('MIKOR')).not.toBeInTheDocument()
  expect(screen.getByText('TÉTELEK')).toBeInTheDocument()
})
