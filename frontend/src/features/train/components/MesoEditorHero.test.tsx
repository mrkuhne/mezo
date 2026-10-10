import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MesoEditorHero } from '@/features/train/components/MesoEditorHero'

const exercises = [
  { name: 'Fekvenyomás ferde padon', muscle: 'chest-upper', workingSets: 4 },
  { name: 'Oldalemelés', muscle: 'shoulder-side', workingSets: 3 },
]
const baseProps = { label: 'Hétfő · Push A · a nap szerkesztése', exercises, daySets: 14, dayExerciseCount: 5, dayMinutes: 0, weekSets: 58, trainingDays: 4, warningCount: 0 }

describe('MesoEditorHero', () => {
  it('says the day as a verdict, the week in the support line, and the ok state', () => {
    render(<MesoEditorHero {...baseProps} />)
    expect(screen.getByText('Hétfő · Push A · a nap szerkesztése')).toBeInTheDocument()
    expect(screen.getByText('14 szett ma, 5 gyakorlat.')).toBeInTheDocument()
    expect(screen.getByText('Heti terhelés: 58 szett · 4 edzésnap')).toBeInTheDocument()
    expect(screen.getByText(/kereten belül/)).toBeInTheDocument()
  })
  it('pours the day into one vessel: a layer per exercise with its sets, and the key under it', () => {
    const { container } = render(<MesoEditorHero {...baseProps} />)
    const layers = Array.from(container.querySelectorAll('.fo-pour > i'))
    expect(layers.map((l) => l.textContent)).toEqual(['4', '3'])
    // the key names each layer by the first word of the exercise
    expect(container.querySelector('.fo-lg')).toHaveTextContent('Fekvenyomás 4')
    expect(container.querySelector('.fo-lg')).toHaveTextContent('Oldalemelés 3')
  })
  it('an empty day is the dashed empty vessel, without a key', () => {
    const { container } = render(<MesoEditorHero {...baseProps} exercises={[]} daySets={0} dayExerciseCount={0} />)
    expect(screen.getByText('üres — ide töltődnek a gyakorlatok')).toBeInTheDocument()
    expect(container.querySelector('.fo-pour.e')).not.toBeNull()
    expect(container.querySelector('.fo-lg')).toBeNull()
  })
  it('shows the warning count when over', () => {
    render(<MesoEditorHero {...baseProps} daySets={18} weekSets={64} warningCount={2} />)
    expect(screen.getByText(/2 jelzés/)).toBeInTheDocument()
    expect(screen.queryByText(/kereten belül/)).not.toBeInTheDocument()
  })
  it('shows the ~perc fragment when dayMinutes > 0 and omits it at 0 (mezo-oyhy.3)', () => {
    const { rerender } = render(<MesoEditorHero {...baseProps} dayMinutes={63} />)
    expect(screen.getByText(/^~63 perc · Heti terhelés/)).toBeInTheDocument()
    rerender(<MesoEditorHero {...baseProps} dayMinutes={0} />)
    expect(screen.queryByText(/~0 perc|~/)).not.toBeInTheDocument()
  })
  it('the liquid row adds an exercise', () => {
    const onAdd = vi.fn()
    render(<MesoEditorHero {...baseProps} onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
    expect(onAdd).toHaveBeenCalled()
  })
  it('a rest day is an empty vessel with its note and no add button', () => {
    render(<MesoEditorHero {...baseProps} off offNote="Aktív pihenő" />)
    expect(screen.getByText('Ez pihenőnap.')).toBeInTheDocument()
    expect(screen.getByText('Aktív pihenő')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gyakorlat hozzáadása/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edzéssé alakít/ })).toBeInTheDocument()
  })
})
