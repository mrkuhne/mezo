// ============================================================
// Mezo · Karakter — TranscriptTurn tests (mezo-qw37.6, Task 5)
// Verifies splitTranscriptLines parses both the current backend prefix
// (FELHASZNÁLÓ VÁLASZA —) and the legacy literal (DANIEL VÁLASZA —) that
// pre-S6 conferences carry forever in their stored transcript envelope.
// ============================================================
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { TranscriptTurn, splitTranscriptLines } from '@/features/character/components/TranscriptTurn'

describe('splitTranscriptLines', () => {
  test('az új FELHASZNÁLÓ VÁLASZA prefix a felhasználó sora', () => {
    expect(splitTranscriptLines('FELHASZNÁLÓ VÁLASZA — nem igaz')).toEqual([{ isUser: true, text: 'nem igaz' }])
  })
  test('a tárolt DANIEL VÁLASZA prefix is felhasználói sor marad (régi konferenciák)', () => {
    expect(splitTranscriptLines('DANIEL VÁLASZA — pontosítom')).toEqual([{ isUser: true, text: 'pontosítom' }])
  })
  test('sima sor nem felhasználói', () => {
    expect(splitTranscriptLines('Szakértői szöveg')).toEqual([{ isUser: false, text: 'Szakértői szöveg' }])
  })
})

test('a felhasználói sor a "Válaszod" arany sávot kapja', () => {
  render(
    <TranscriptTurn
      turn={{ persona: 'drill', text: 'Bevezető\nFELHASZNÁLÓ VÁLASZA — talál', refIds: [] }}
      kind="EXPERT" displayName="Drill" color="#000"
    />,
  )
  expect(screen.getByText('Válaszod')).toBeInTheDocument()
  expect(screen.getByText('talál')).toBeInTheDocument()
})
