import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { KonziliumConversationView } from './KonziliumConversationView'
import { MOCK_CONFERENCE_DETAIL, MOCK_EXPERTS } from '@/data/character/characterMock'

const THREADS = MOCK_CONFERENCE_DETAIL.w2.deliberation!

describe('KonziliumConversationView', () => {
  test('mind a négy kör szekciója látszik', () => {
    render(<KonziliumConversationView threads={THREADS} experts={MOCK_EXPERTS} crossTalkRan />)
    for (const label of ['Javaslatok', 'Kereszt-vita', 'Szkeptikus', 'Mezo dönt']) {
      // Fix round 1 (mezo-sp9w, task-8 impl): a plain getByText(label) is ambiguous against the
      // full fixture — "Szkeptikus" is both a section label AND a turn speaker name (three items
      // carry a skeptic verdict), so scope the match to the section-label element.
      expect(screen.getByText(label, { selector: '.kr-cvlbl' })).toBeInTheDocument()
    }
  })

  test('a kereszt-vita blokk idézi, mire reagáltak', () => {
    render(<KonziliumConversationView threads={THREADS} experts={MOCK_EXPERTS} crossTalkRan />)
    // Fix round 1 (mezo-sp9w, task-8 impl): the claim's own text also appears verbatim in the
    // Javaslatok section, so scope the match to the Kereszt-vita quote block specifically.
    expect(screen.getByText(/A hétvégi lefekvés két órával kitolódik/, { selector: '.kr-cvquote' })).toBeInTheDocument()
    // Fix round 1 (mezo-sp9w, task-8 impl): 'támogatja' also appears on the Fizikai thread's
    // (item index 2) single SUPPORT reaction, so more than one chip is expected here.
    expect(screen.getAllByText('támogatja').length).toBeGreaterThan(0)
    expect(screen.getByText('vitatja')).toBeInTheDocument()
  })

  test('üres kereszt-vita kör megmarad szekcióként és megmondja, hogy nem volt hozzászólás', () => {
    render(<KonziliumConversationView threads={[THREADS[2]]} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText('Kereszt-vita')).toBeInTheDocument()
    expect(screen.getByText('Ebben a körben senki nem szólt hozzá más felvetéséhez.')).toBeInTheDocument()
  })

  test('a kereszt-vita kör előtti konzíliumnál a szekció ezt mondja, nem azt hogy senki nem szólt', () => {
    render(<KonziliumConversationView threads={[THREADS[2]]} experts={MOCK_EXPERTS} crossTalkRan={false} />)
    expect(screen.getByText('Ez a konzílium a kereszt-vita kör bevezetése előtt zajlott.')).toBeInTheDocument()
  })

  test('a válasz nélküli körök is megmaradnak, saját magyarázattal', () => {
    render(<KonziliumConversationView threads={[THREADS[3]]} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText('A Szkeptikus ebben a körben nem adott választ.')).toBeInTheDocument()
    expect(screen.getByText('Ebben a körben nem született döntés.')).toBeInTheDocument()
  })
})
