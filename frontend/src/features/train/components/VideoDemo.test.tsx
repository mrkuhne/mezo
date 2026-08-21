import { render, screen, fireEvent } from '@testing-library/react'
import { VideoDemo, youTubeId, instagramEmbedPath, videoEmbed } from '@/features/train/components/VideoDemo'

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

describe('instagramEmbedPath', () => {
  it('keeps the post kind and shortcode from every recognized url shape', () => {
    expect(instagramEmbedPath('https://www.instagram.com/reel/DAbc-1_x2yZ/')).toBe('reel/DAbc-1_x2yZ')
    expect(instagramEmbedPath('https://instagram.com/p/CXyz123abcd/')).toBe('p/CXyz123abcd')
    expect(instagramEmbedPath('https://www.instagram.com/tv/CXyz123abcd/')).toBe('tv/CXyz123abcd')
  })

  it('normalizes the plural reels/ share path to the embeddable reel/', () => {
    expect(instagramEmbedPath('https://www.instagram.com/reels/DAbc-1_x2yZ/')).toBe('reel/DAbc-1_x2yZ')
  })

  it('accepts the profile-scoped share form and drops the tracking query', () => {
    expect(instagramEmbedPath('https://www.instagram.com/jeff.nippard/reel/DAbc-1_x2yZ/?igsh=Ntb3Q')).toBe(
      'reel/DAbc-1_x2yZ',
    )
  })

  it('returns null for a non-post instagram url or another host', () => {
    expect(instagramEmbedPath('https://www.instagram.com/jeff.nippard/')).toBeNull()
    expect(instagramEmbedPath('https://youtu.be/abc123DEFgh')).toBeNull()
  })
})

describe('videoEmbed', () => {
  it('resolves a youtube url to the nocookie embed in landscape', () => {
    expect(videoEmbed('https://youtu.be/abc123DEFgh')).toEqual({
      src: 'https://www.youtube-nocookie.com/embed/abc123DEFgh',
      aspectRatio: '16 / 9',
    })
  })

  it('resolves an instagram url to the embed endpoint in portrait', () => {
    expect(videoEmbed('https://www.instagram.com/reel/DAbc-1_x2yZ/')).toEqual({
      src: 'https://www.instagram.com/reel/DAbc-1_x2yZ/embed',
      aspectRatio: '9 / 16',
    })
  })

  it('returns null for a missing or unrecognized url', () => {
    expect(videoEmbed(null)).toBeNull()
    expect(videoEmbed(undefined)).toBeNull()
    expect(videoEmbed('https://vimeo.com/12345')).toBeNull()
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

  it('lazy-mounts the instagram embed on tap', () => {
    render(<VideoDemo url="https://www.instagram.com/reel/DAbc-1_x2yZ/" />)
    expect(screen.queryByTitle('Demo videó')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /demo/i }))
    const frame = screen.getByTitle('Demo videó') as HTMLIFrameElement
    expect(frame.src).toBe('https://www.instagram.com/reel/DAbc-1_x2yZ/embed')
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
