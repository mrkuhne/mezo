import { render, screen, fireEvent } from '@testing-library/react'
import { VideoDemo, youTubeId } from '@/features/train/components/VideoDemo'

describe('youTubeId', () => {
  it('extracts the id from every recognized url shape', () => {
    expect(youTubeId('https://youtu.be/abc123DEFgh')).toBe('abc123DEFgh')
    expect(youTubeId('https://www.youtube.com/watch?v=abc123DEFgh')).toBe('abc123DEFgh')
    expect(youTubeId('https://youtube.com/embed/abc123DEFgh')).toBe('abc123DEFgh')
    expect(youTubeId('https://www.youtube-nocookie.com/embed/abc123DEFgh')).toBe('abc123DEFgh')
    expect(youTubeId('https://www.youtube.com/shorts/abc123DEFgh')).toBe('abc123DEFgh')
  })

  it('returns null for an unrecognized url', () => {
    expect(youTubeId('https://vimeo.com/12345')).toBeNull()
    expect(youTubeId('not a url')).toBeNull()
  })
})

describe('VideoDemo', () => {
  it('extracts the id from a youtu.be url and lazy-mounts the iframe on tap', () => {
    render(<VideoDemo url="https://youtu.be/abc123DEFgh" />)
    expect(screen.queryByTitle('Demo videó')).toBeNull() // not mounted yet
    fireEvent.click(screen.getByRole('button', { name: /demo/i }))
    const frame = screen.getByTitle('Demo videó') as HTMLIFrameElement
    expect(frame.src).toContain('youtube-nocookie.com/embed/abc123DEFgh')
  })

  it('renders nothing when url is null', () => {
    const { container } = render(<VideoDemo url={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the url is unrecognized', () => {
    const { container } = render(<VideoDemo url="https://vimeo.com/12345" />)
    expect(container).toBeEmptyDOMElement()
  })
})
