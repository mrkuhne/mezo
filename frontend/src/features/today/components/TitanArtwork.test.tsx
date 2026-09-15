import { act, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { TitanArtwork } from '@/features/today/components/TitanCompanion'

const scene = vi.hoisted(() => ({ props: {} as { decorations?: boolean; onReady?: () => void; onUnavailable?: () => void } }))
vi.mock('@/features/today/components/TitanScene', () => ({
  TitanScene: (props: typeof scene.props) => { scene.props = props; return <canvas /> },
}))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('live startup never flashes the SVG while its undecorated scene loads', async () => {
  vi.stubGlobal('WebGL2RenderingContext', class {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
  const ready = vi.fn()
  const { container } = render(<TitanArtwork onReady={ready} />)
  expect(container.querySelector('.titan-svg')).toBeNull()
  await act(async () => { await Promise.resolve() })
  expect(container.querySelector('canvas')).not.toBeNull()
  expect(scene.props.decorations).toBe(false)
  expect(ready).not.toHaveBeenCalled()
  act(() => scene.props.onReady?.())
  expect(ready).toHaveBeenCalledOnce()
  act(() => scene.props.onUnavailable?.())
  expect(container.querySelector('.titan-svg')).not.toBeNull()
  expect(container.querySelector('.titan-rings')).toBeNull()
})
