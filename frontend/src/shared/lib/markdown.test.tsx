import { render } from '@testing-library/react'
import { Markdown, renderInline } from '@/shared/lib/markdown'

describe('renderInline', () => {
  test('renders **bold**, *italic* and `code`', () => {
    const { container } = render(<>{renderInline('a **b** c *d* e `f`')}</>)
    expect(container.querySelector('strong')?.textContent).toBe('b')
    expect(container.querySelector('em')?.textContent).toBe('d')
    expect(container.querySelector('code')?.textContent).toBe('f')
  })

  test('leaves snake_case alone (underscores are NOT italic markers)', () => {
    const { container } = render(<>{renderInline('get_recent_workouts(days=3)')}</>)
    expect(container.querySelector('em')).toBeNull()
    expect(container.textContent).toBe('get_recent_workouts(days=3)')
  })

  test('never injects HTML', () => {
    const { container } = render(<>{renderInline('<img src=x onerror=alert(1)> **ok**')}</>)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('Markdown blocks', () => {
  test('splits blank-line separated paragraphs', () => {
    const { container } = render(<Markdown text={'Első bekezdés.\n\nMásodik bekezdés.'} />)
    const ps = container.querySelectorAll('p')
    expect(ps).toHaveLength(2)
    expect(ps[0].textContent).toBe('Első bekezdés.')
    expect(ps[1].textContent).toBe('Második bekezdés.')
  })

  test('renders a - bullet list as <ul><li>', () => {
    const { container } = render(<Markdown text={'Nézzük:\n- alvás 7h\n- súly -0.4 kg\n* fehérje 150g'} />)
    const items = container.querySelectorAll('ul li')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toBe('alvás 7h')
    expect(items[2].textContent).toBe('fehérje 150g')
  })

  test('renders a numbered list as <ol><li>', () => {
    const { container } = render(<Markdown text={'1. első\n2. második'} />)
    const items = container.querySelectorAll('ol li')
    expect(items).toHaveLength(2)
    expect(items[1].textContent).toBe('második')
  })

  test('renders ## headings without the hash marks', () => {
    const { container } = render(<Markdown text={'## Összegzés\nSzöveg.'} />)
    const heading = container.querySelector('.md-h')
    expect(heading?.textContent).toBe('Összegzés')
    expect(container.textContent).not.toContain('#')
  })

  test('keeps a **bold** lead-in on a list item out of the bullet parser', () => {
    const { container } = render(<Markdown text={'**Fontos**: ez nem lista.'} />)
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('Fontos')
  })

  test('preserves single newlines inside a paragraph', () => {
    const { container } = render(<Markdown text={'egy\nkettő'} />)
    const p = container.querySelector('p')
    expect(p?.textContent).toBe('egy\nkettő')
  })

  test('renders a plain one-liner as a single paragraph', () => {
    const { container } = render(<Markdown text="Ez csak egy mondat." />)
    expect(container.querySelectorAll('p')).toHaveLength(1)
    expect(container.textContent).toBe('Ez csak egy mondat.')
  })

  test('renders nothing for empty text', () => {
    const { container } = render(<Markdown text="" />)
    expect(container.textContent).toBe('')
  })
})
