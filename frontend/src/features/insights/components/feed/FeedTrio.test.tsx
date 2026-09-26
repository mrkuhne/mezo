import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'
import { usePatternActions, useObservationReply } from '@/data/hooks'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
import { ArtifactTrio, FeedTrio } from './FeedTrio'

vi.mock('@/data/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  usePatternActions: vi.fn(),
  useObservationReply: vi.fn(),
}))

const base: FeedPost = {
  id: 'pattern:p1', kind: 'kerdes', author: 'falat', occurredAt: '2026-09-23T10:00:00',
  body: 'A késői vacsora után rosszabb az éjszakád.', sourceRoute: '/mezo/patterns/k', waiting: true,
}
const kerdesPost: FeedPost = { ...base, decision: { patternId: 'p1' } }
const megfigyelesPost: FeedPost = { ...base, id: 'character:x', kind: 'megfigyeles', waiting: false }
const obsPost: FeedPost = { ...base, id: 'observation:o1', observation: { patternId: 'op-1' } }

const reply = vi.fn()
beforeEach(() => {
  reply.mockReset().mockResolvedValue({})
  vi.mocked(useObservationReply).mockReturnValue({ reply, pendingPatternId: undefined })
  vi.mocked(usePatternActions).mockReturnValue({ decide: vi.fn(), pending: false })
})

const renderTrio = (post: FeedPost, onReply = vi.fn()) =>
  render(<FeedTrio post={post} onReply={onReply} />, { wrapper: QueryWrapper })

test('döntés-poszton az Ez talál a pattern-decide-ot hívja és utóéletet renderel', async () => {
  const decide = vi.fn()
  vi.mocked(usePatternActions).mockReturnValue({ decide, pending: false })
  renderTrio(kerdesPost)
  await userEvent.click(screen.getByRole('button', { name: /ez talál/i }))
  expect(decide).toHaveBeenCalledWith('p1', 'confirm')
  expect(await screen.findByText(/bekerült a rólad szóló képbe/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /ez talál/i })).not.toBeInTheDocument()
})

test('döntés-poszton a Nem így érzem elvet és visszakérdez (megnyitja a válasz-lapot)', async () => {
  const decide = vi.fn()
  const onReply = vi.fn()
  vi.mocked(usePatternActions).mockReturnValue({ decide, pending: false })
  renderTrio(kerdesPost, onReply)
  await userEvent.click(screen.getByRole('button', { name: /nem így érzem/i }))
  expect(decide).toHaveBeenCalledWith('p1', 'reject')
  expect(onReply).toHaveBeenCalledWith(kerdesPost, 'down')
  expect(await screen.findByText(/feljegyeztük/i)).toBeInTheDocument()
})

test('észrevétel-kérdésen a hármas a meglévő chip-választ hívja', async () => {
  renderTrio(obsPost)
  await userEvent.click(screen.getByRole('button', { name: 'Igen, ez igaz rám' }))
  expect(reply).toHaveBeenCalledWith('op-1', 'watch')
  expect(await screen.findByText(/figyeljük tovább/i)).toBeInTheDocument()
})

test('sikertelen észrevétel-válasz: nincs hamis utóélet, őszinte hibaüzenet', async () => {
  reply.mockRejectedValueOnce(new Error('boom'))
  renderTrio(obsPost)
  await userEvent.click(screen.getByRole('button', { name: 'Igen, ez igaz rám' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/nem sikerült/i)
  expect(screen.queryByText(/figyeljük tovább/i)).not.toBeInTheDocument()
})

test('nem-döntés poszton a hármas csak visszajelzés (nincs decide-hívás), visszavonható', async () => {
  const decide = vi.fn()
  vi.mocked(usePatternActions).mockReturnValue({ decide, pending: false })
  renderTrio(megfigyelesPost)
  const up = screen.getByRole('button', { name: /ez talál/i })
  await userEvent.click(up)
  expect(decide).not.toHaveBeenCalled()
  expect(reply).not.toHaveBeenCalled()
  expect(up).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(up)
  expect(up).toHaveAttribute('aria-pressed', 'false')
})

test('a gombfeliratok pontosan a spec szerint; az Elmesélem a válasz-lapot kéri', async () => {
  const onReply = vi.fn()
  renderTrio(megfigyelesPost, onReply)
  for (const name of ['Ez talál', 'Nem így érzem', 'Elmesélem'])
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Elmesélem' }))
  expect(onReply).toHaveBeenCalledWith(megfigyelesPost, 'tell')
})

test('a rekordból hozott utóélet a hármas helyén áll', () => {
  renderTrio({ ...obsPost, afterlife: 'Figyeljük tovább · szólunk, ha kiderül' })
  expect(screen.getByText(/figyeljük tovább/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /ez talál/i })).not.toBeInTheDocument()
})


test('observation trio offers the approved replies and talk handoff', async () => {
  const onReply = vi.fn()
  renderTrio(obsPost, onReply)
  for (const name of ['Igen, ez igaz rám', 'Nem, ez nem stimmel', 'Beszéljük meg'])
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Beszéljük meg' }))
  expect(onReply).toHaveBeenCalledWith(obsPost, 'tell')
})

// Csapat-chat (mezo-a9bo7.24): ugyanaz a hármas egy szerver-oldali műterméken — a 👍/👎 a közös
// visszajelzés-kezelőbe megy a sor azonosítójával, a „Nem így érzem” a válasz-lapot is kéri.
test('ArtifactTrio: a szavazat a műtermék azonosítójával megy, a le-szavazat a lapot is nyitja', async () => {
  const vote = vi.fn()
  const onReply = vi.fn()
  const handle = { get: () => undefined, vote, pending: false }
  render(<ArtifactTrio feedback={handle} artifactId="line-1" onReply={onReply} />)
  await userEvent.click(screen.getByRole('button', { name: /ez talál/i }))
  expect(vote).toHaveBeenCalledWith('line-1', 'up')
  await userEvent.click(screen.getByRole('button', { name: /nem így érzem/i }))
  expect(vote).toHaveBeenCalledWith('line-1', 'down')
  expect(onReply).toHaveBeenCalledWith('down')
  await userEvent.click(screen.getByRole('button', { name: /elmesélem/i }))
  expect(onReply).toHaveBeenCalledWith('tell')
})
