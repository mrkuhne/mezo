import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageProvider, setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { ErrorRow, FoSheetHead, FrameBack, HistoryBackButton, Msg, SheetActs, Skel, Stepper, TitleRow, memberLabel, memberMeta } from './index'
import type { Member } from './Badge'

const MEMBERS: Member[] = ['szunya', 'mocor', 'falat', 'deru', 'mezo', 'szk']
const noop = () => {}

afterEach(() => setLang('hu', { persist: false }))

describe('the kit speaks English', () => {
  it('built-in strings follow the language', () => {
    setLang('en', { persist: false })
    render(
      <MemoryRouter>
        <Stepper label="Water" value="2" onDec={noop} onInc={noop} />
        <SheetActs label="Save" onCancel={noop} />
        <FoSheetHead title="T" onBack={noop} onClose={noop} />
        <ErrorRow message="x" onRetry={noop} />
        <Skel />
        <TitleRow context="c" title="t" onBack={noop} />
        <HistoryBackButton fallback="/" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Decrease Water' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase Water' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(3)
  })

  it('FrameBack outside a title bar says Back in English', () => {
    setLang('en', { persist: false })
    render(<MemoryRouter><FrameBack onBack={noop} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('a prop override still wins in English', () => {
    setLang('en', { persist: false })
    render(
      <MemoryRouter>
        <SheetActs label="S" onCancel={noop} cancelLabel="Nope" />
        <FoSheetHead title="T" onBack={noop} backLabel="Up" />
        <ErrorRow message="x" onRetry={noop} retryLabel="Again" />
        <Skel label="Wait" />
        <TitleRow context="c" title="t" backLabel="Home" onBack={noop} />
      </MemoryRouter>,
    )
    for (const n of ['Nope', 'Up', 'Again', 'Home']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Wait' })).toBeInTheDocument()
  })

  it('Hungarian stays word for word', () => {
    render(<MemoryRouter><Stepper label="Víz" value="2" onDec={noop} onInc={noop} /><FoSheetHead title="T" onBack={noop} onClose={noop} /></MemoryRouter>)
    for (const n of ['Víz csökkentése', 'Víz növelése', 'Bezárás', 'Vissza']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
  })

  it('memberLabel / memberMeta cover every key in both languages', () => {
    expect(MEMBERS.map(memberLabel)).toEqual(['Alvás', 'Mozgás', 'Étkezés', 'Közérzet', 'Mezo', 'Szkeptikus'])
    expect(MEMBERS.map(memberMeta)).toEqual(['pihenés', 'terhelés', 'étrend', 'hangulat', 'összkép', ''])
    setLang('en', { persist: false })
    expect(MEMBERS.map(memberLabel)).toEqual(['Sleep', 'Movement', 'Food', 'Mood', 'Mezo', 'Skeptic'])
    expect(MEMBERS.map(memberMeta)).toEqual(['rest', 'load', 'diet', 'mood', 'the whole picture', ''])
  })

  it('Msg drops a meta that only repeats the field, in both languages', () => {
    const { container, rerender } = render(<Msg member="szunya" meta="alvás · ma reggel">x</Msg>)
    expect(container.querySelector('.nm small')?.textContent).toBe('ma reggel')
    rerender(<Msg member="falat" meta="étel">x</Msg>)
    expect(container.querySelector('.nm small')?.textContent).toBe('étrend')
    setLang('en', { persist: false })
    rerender(<Msg member="szunya" meta="sleep · this morning">x</Msg>)
    expect(container.querySelector('.nm')?.textContent).toBe('Sleepthis morning')
    rerender(<Msg member="deru" meta="mood">x</Msg>)
    expect(container.querySelector('.nm small')?.textContent).toBe('mood')
    rerender(<Msg member="falat" meta="Food">x</Msg>)
    expect(container.querySelector('.nm small')?.textContent).toBe('diet')
    rerender(<Msg member="falat" meta="nutrition · lunch">x</Msg>)
    expect(container.querySelector('.nm small')?.textContent).toBe('lunch')
  })

  it('switching the language at runtime changes the built-in label', () => {
    render(<QueryWrapper><MemoryRouter><LanguageProvider><SheetActs label="S" onCancel={noop} /></LanguageProvider></MemoryRouter></QueryWrapper>)
    expect(screen.getByRole('button', { name: 'Mégse' })).toBeInTheDocument()
    act(() => setLang('en', { persist: false }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
})
