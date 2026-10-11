import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { TrainSettingsPage } from '@/features/settings/pages/TrainSettingsPage'
import { MeSettingsPage } from '@/features/settings/pages/MeSettingsPage'
import { MezoSettingsPage } from '@/features/settings/pages/MezoSettingsPage'
import { NapSettingsPage } from '@/features/settings/pages/NapSettingsPage'
import { AccountSettingsPage } from '@/features/settings/pages/AccountSettingsPage'
import { MezoPersonalPage } from '@/features/settings/pages/MezoPersonalPage'

// The Settings pages in English: heading, section labels and a representative row, verbatim from the
// approved prototype (`vilagos/en.js`) wherever it has the string. Mock mode, so no fetch.
beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => vi.unstubAllEnvs())

const mount = (ui: React.ReactElement, route = '/settings') =>
  render(<QueryWrapper><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></QueryWrapper>)

describe('Settings in English', () => {
  it('hub: heading, section labels, the area rows and the general row sub-line', () => {
    mount(<SettingsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Make it yours.' })).toBeInTheDocument()
    expect(screen.getByText('Everything that fits Mezo to you, in one place.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your areas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The app around you' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Training Make room to move\./ })).toHaveAttribute('href', '/settings/train')
    expect(screen.getByRole('link', { name: /Appearance and app/ })).toHaveAttribute('href', '/settings/general')
    expect(screen.getByText('Language, guides, account, password')).toBeInTheDocument()
    expect(screen.getByText(/Every area uses the same basics\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the page' })).toBeInTheDocument()
  })

  it('hub: the page text follows a language change at runtime, without a remount', () => {
    setLang('hu', { persist: false })
    mount(<SettingsPage />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Legyen a tiéd.')
    expect(screen.getByText('Nyelv, kalauzok, fiók, jelszó')).toBeInTheDocument()
    act(() => setLang('en', { persist: false }))
    expect(screen.getByRole('heading', { level: 1 })).toBe(h1)
    expect(h1).toHaveTextContent('Make it yours.')
    expect(screen.getByText('Language, guides, account, password')).toBeInTheDocument()
  })

  it('Training: heading, week strip, section rows', () => {
    mount(<TrainSettingsPage />, '/settings/train')
    expect(screen.getByRole('heading', { level: 1, name: 'Training' })).toBeInTheDocument()
    expect(screen.getByText('Make room to move. The rest of the week follows.')).toBeInTheDocument()
    expect(screen.getByLabelText('Weekly gym times')).toHaveTextContent('Mo')
    expect(screen.getByText('gym times / week')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Regular sport/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Workout reminders/ })).toBeInTheDocument()
  })

  it('Me: heading, stats and rows', () => {
    mount(<MeSettingsPage />, '/settings/me')
    expect(screen.getByRole('heading', { level: 1, name: 'Me' })).toBeInTheDocument()
    expect(screen.getByText('Your body, your goals, your rest.')).toBeInTheDocument()
    expect(screen.getByText('Height · body profile')).toBeInTheDocument()
    expect(screen.getByText('Sleep goal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Body profile/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Weight goal/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sleep and daily anchors/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /What does Mezo know about me\?/ })).toBeInTheDocument()
  })

  it('Mezo: heading, section labels and rows', () => {
    mount(<MezoSettingsPage />, '/settings/mezo')
    expect(screen.getByRole('heading', { level: 1, name: 'Mezo and you' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How we talk' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works, in the open' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /About me/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /How to talk to me/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /What Mezo receives/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Signals from Mezo/ })).toBeInTheDocument()
  })

  it('Today: heading, anchors and rows', () => {
    mount(<NapSettingsPage />, '/settings/nap')
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('The rhythm that holds your day together.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Wake-up and bedtime/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Check-in and day close/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Meal rhythm/ })).toBeInTheDocument()
  })

  it('Account: heading and form labels', async () => {
    mount(<AccountSettingsPage />, '/settings/account')
    expect(screen.getByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save account details' })).toBeInTheDocument()
  })

  it('personal context: About me, How to talk to me, What Mezo receives', async () => {
    const view = mount(<MezoPersonalPage mode="about" />, '/settings/mezo/about')
    expect(screen.getByRole('heading', { level: 1, name: 'About me, in my own words' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Your own introduction')).toBeInTheDocument()
    expect(screen.getByText('Where the facts come from')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Name and account/ })).toBeInTheDocument()
    view.unmount()

    const talk = mount(<MezoPersonalPage mode="communication" />, '/settings/mezo/communication')
    expect(screen.getByRole('heading', { level: 1, name: 'How to talk to me' })).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: 'Use the learned communication profile' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    talk.unmount()

    mount(<MezoPersonalPage mode="context" />, '/settings/mezo/context')
    expect(screen.getByRole('heading', { level: 1, name: 'What Mezo receives' })).toBeInTheDocument()
    expect(await screen.findByText('The exact assembled text')).toBeInTheDocument()
    expect(screen.getByText(/not the full system prompt/)).toBeInTheDocument()
    const list = document.querySelector('.personal-context-list') as HTMLElement
    expect(within(list).getAllByText(/^(Included|Not included)$/).length).toBeGreaterThan(0)
  })
})
