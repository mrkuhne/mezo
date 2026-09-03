import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import { ScoreLedger } from '@/features/fuel/components/ScoreLedger'
import type { MealDimension } from '@/data/types'

const dims = [
  { id: 'macro', label: 'Makró', weight: 0.35, score: 0.64, color: 'red', detail: '',
    macroRatio: { p: 0, c: 0, f: 0 }, macroTargets: { p: '', c: '', f: '' }, kcalShareOfDay: 0 },
  { id: 'context', label: 'Kontextus', weight: 0.2, score: 0.52, color: 'blue', detail: '', context: [] },
] as MealDimension[]

test('one segment per dimension, flex = weight, fill = score, Σ = weight×score×100', () => {
  const { container } = render(<ScoreLedger dimensions={dims} />)
  const segs = container.querySelectorAll<HTMLElement>('.sb-ledger-seg')
  expect(segs).toHaveLength(2)
  expect(segs[0].style.flexGrow).toBe('0.35')
  expect((segs[0].firstElementChild as HTMLElement).style.width).toBe('64%')
  expect(screen.getByText('Σ')).toBeInTheDocument()
  expect(screen.getByText('32,8')).toBeInTheDocument() // 22.4 + 10.4
  expect(screen.getByText('35%')).toBeInTheDocument()
})

test('kihagyja a degraded dimenziót a sávból és Nincs adat sorként mutatja', () => {
  const degradedDims = [
    { id: 'macro', label: 'Kcal & makró', weight: 0.65, score: 0.8, color: '#8FAF7E', detail: '',
      macroRatio: { p: 0, c: 0, f: 0 }, macroTargets: { p: '', c: '', f: '' }, kcalShareOfDay: 0 },
    { id: 'context', label: 'Időzítés', weight: 0.35, score: 0.9, color: '#4E8FB8', detail: '', context: [] },
    { id: 'nova', label: 'NOVA', weight: 0, score: 0, color: '#C9962E', detail: '' },
  ] as MealDimension[]
  const { container } = render(<ScoreLedger dimensions={degradedDims} />)
  // only the two live dims get a bar segment
  expect(container.querySelectorAll('.sb-ledger-seg')).toHaveLength(2)
  // the degraded dim is named in the "Nincs adat" line, not in the %-row
  expect(screen.getByText(/Nincs adat/)).toHaveTextContent('NOVA')
  expect(screen.queryByText('0%')).not.toBeInTheDocument()
  // Σ still equals weight×score×100 over the LIVE dims only (weights already renormalized upstream)
  expect(screen.getByText('83,5')).toBeInTheDocument() // 0.65*0.8*100 + 0.35*0.9*100 = 52 + 31.5
})
