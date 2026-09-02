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
