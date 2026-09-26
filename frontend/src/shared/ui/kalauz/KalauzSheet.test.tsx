import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KalauzSheet, type KalauzSheetCard } from '@/shared/ui/kalauz/KalauzSheet'

const CARDS: KalauzSheetCard[] = [
  { kind: 'intro', spot: 'i-fuel', title: 'Ez a Fuel.', voice: 'Első **kártya**.' },
  { kind: 'fogalom', spot: 's-energia', title: 'Keret.', voice: 'Második.', term: 'makró', def: 'Építőanyag.' },
  { kind: 'hogyan', spot: 'i-reggeli', title: 'Logolás.', voice: 'Harmadik.', anchor: 'fuel-log' },
  { kind: 'kapcsolat', title: 'Nem sziget.', voice: 'Negyedik.', links: [{ to: '/train', label: 'Edzés', icon: 'i-edzes' }] },
]

const setup = (cards = CARDS) => {
  const onClose = vi.fn()
  const onNavigate = vi.fn()
  render(<KalauzSheet label="Fuel" cards={cards} onClose={onClose} onNavigate={onNavigate} />)
  return { onClose, onNavigate, user: userEvent.setup() }
}

test('az első kártyával nyílik, a Vissza tiltva, a lépésszám 1 / 4', () => {
  setup()
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(screen.getByText('Ez a Fuel.')).toBeInTheDocument()
  expect(screen.getByText('1 / 4')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Előző kártya' })).toBeDisabled()
})

test('üveg-lap: arany glass sheet, a kártya képe NAGY 3D ikon (agyag orb nélkül)', async () => {
  const { user } = setup()
  const dialog = screen.getByRole('dialog', { name: 'Kalauz · Fuel' })
  expect(dialog).toHaveClass('glass', 'uv-sheet', 'kalauz-sheet')
  // i-fuel → t-bowl a CLAY_TO_3D-n át; nincs agyag orb / spot a kártyán
  expect(dialog.querySelector('.kalauz-art use')?.getAttribute('href')).toBe('#t-bowl')
  expect(dialog.querySelector('.kalauz-art svg')).toHaveAttribute('width', '92')
  expect(dialog.querySelector('use[href^="#s-orb"]')).toBeNull()
  // egy spot (s-energia) a kalauz saját jelentés-térképén át lesz 3D (t-bolt)
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(dialog.querySelector('.kalauz-art use')?.getAttribute('href')).toBe('#t-bolt')
  // a kapcsolat-kártya képe a lánc, a chipje 3D ikon
  await user.click(screen.getByRole('button', { name: '4. kártya' }))
  expect(dialog.querySelector('.kalauz-art use')?.getAttribute('href')).toBe('#t-link')
  expect(dialog.querySelector('.kalauz-chip use')?.getAttribute('href')).toBe('#t-dumbbell')
})

test('Tovább / Vissza / pötty lapoz; az utolsón a CTA „Értem, kezdjük" és a Kihagyom eltűnik', async () => {
  const { user, onClose } = setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByText('Keret.')).toBeInTheDocument()
  expect(screen.getByText('makró')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Előző kártya' }))
  expect(screen.getByText('Ez a Fuel.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '4. kártya' }))
  expect(screen.getByText('Nem sziget.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kihagyom' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Értem, kezdjük' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledWith('done', 3))
})

test('Kihagyom és Escape a lépésszámmal zár', async () => {
  const { user, onClose } = setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledWith('skip', 1))
})

test('a kapcsolat-chip navigál és zár', async () => {
  const { user, onClose, onNavigate } = setup()
  await user.click(screen.getByRole('button', { name: '4. kártya' }))
  await user.click(screen.getByRole('button', { name: /Edzés/ }))
  expect(onNavigate).toHaveBeenCalledWith('/train')
  await waitFor(() => expect(onClose).toHaveBeenCalledWith('done', 3))
})

test('„Mutasd meg" csak akkor renderel, ha az anchor a DOM-ban van; peek → bárhova koppintás visszahoz', async () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"><div data-kalauz-anchor="fuel-log">tile</div></div>')
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: '3. kártya' }))
  // a „◎" jel helyett a 3D szem (t-eye) — a jelentés a gomb szövegében
  expect(screen.getByRole('button', { name: 'Mutasd meg a képernyőn' }).querySelector('use')?.getAttribute('href')).toBe('#t-eye')
  expect(screen.getByRole('button', { name: 'Mutasd meg a képernyőn' }).textContent).not.toContain('◎')
  await user.click(screen.getByRole('button', { name: 'Mutasd meg a képernyőn' }))
  const dialog = screen.getByRole('dialog', { name: 'Kalauz · Fuel' })
  expect(dialog).toHaveClass('is-peek')
  expect(document.querySelector('.kalauz-spot')).not.toBeNull()
  // regresszió-pin: a spot a .phone-screen közvetlen gyereke (portál), nem a transzformált sheet leszármazottja
  expect(document.querySelector('.kalauz-spot')?.parentElement).toBe(document.querySelector('.phone-screen'))
  // a peek-sáv: 3D szem a kútban, „Koppints bárhova.", Vissza
  expect(dialog.querySelector('.kalauz-peekbar use')?.getAttribute('href')).toBe('#t-eye')
  expect(screen.getByText('Koppints bárhova.')).toBeInTheDocument()
  // a hátlap koppintása NEM zár — visszahozza a sheetet
  await user.click(document.querySelector('.sheet-backdrop')!)
  expect(dialog).not.toHaveClass('is-peek')
  expect(document.querySelector('.kalauz-spot')).toBeNull()
  document.querySelector('.phone-screen')!.remove()
})

test('anchor nélkül nincs „Mutasd meg" gomb (honest state)', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: '3. kártya' }))
  expect(screen.queryByRole('button', { name: 'Mutasd meg a képernyőn' })).toBeNull()
})
